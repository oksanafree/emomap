import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminApp, getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { computePatternVariables, type ReportEntry } from "@/lib/report-patterns";
import { formatCustomTokens } from "@/lib/context-labels";
import {
  SYSTEM_PROMPT,
  buildGenderInstruction,
  buildReportUserMessage,
  buildTranslationPrompt,
} from "@/lib/report-prompt";

// Same verified Resend sending domain used by the welcome/reminder emails in
// functions/src/index.ts.
const REPORT_READY_EMAIL_FROM = "Emomapp <reminder@mail.emomapp.app>";

const REPORT_READY_EMAIL_CONTENT: Record<"en" | "ru", Record<"short" | "full", { subject: string; body: string }>> = {
  en: {
    short: {
      subject: "Your Emomapp report is ready",
      body: "Your first Emomapp report is ready — based on your first 5 check-ins, it surfaces what your map is starting to show. Open the app to read it. — Emomapp",
    },
    full: {
      subject: "Your full Emomapp report is ready",
      body: "Your full Emomapp report is ready — based on 20 check-ins, it reveals the patterns in your map. Open the app to read it. — Emomapp",
    },
  },
  ru: {
    short: {
      subject: "Твой отчёт в Эмокарте готов",
      body: "Твой первый отчёт в Эмокарте готов — на основе первых 5 отметок он показывает, что начинает проявляться на твоей карте. Открой приложение, чтобы прочитать его. — Эмокарта",
    },
    full: {
      subject: "Твой полный отчёт в Эмокарте готов",
      body: "Твой полный отчёт в Эмокарте готов — на основе 20 отметок он раскрывает паттерны твоей карты. Открой приложение, чтобы прочитать его. — Эмокарта",
    },
  },
};

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let locale: string | undefined;
  let type: unknown;
  try {
    const body = await request.json();
    userId = body.userId;
    locale = body.locale;
    type = body.type;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const db = getAdminDb();

  let userData: FirebaseFirestore.DocumentData | undefined;
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    userData = userSnap.data();
  } catch (error) {
    console.error("Failed to fetch user profile for report generation", error);
  }

  let entriesChronological: ReportEntry[];
  try {
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("entries")
      .orderBy("timestamp", "asc")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No entries found for this user." }, { status: 404 });
    }

    entriesChronological = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        timestamp: data.timestamp.toDate(),
        world_value: data.world_value,
        self_value: data.self_value,
        x: data.x,
        y: data.y,
        state: data.state,
        context: formatCustomTokens(data.custom_tokens),
      } satisfies ReportEntry;
    });
  } catch (error) {
    console.error("Failed to fetch entries for report generation", error);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }

  // The requested locale only controls which saved version the push
  // notification links to below — generation itself always happens in
  // English, then gets translated, so both languages come from the same
  // analysis instead of being written independently and potentially
  // disagreeing with each other.
  const requestedLocale = locale === "ru" ? "ru" : "en";
  const reportType: "short" | "full" =
    type === "short" || type === "full" ? type : entriesChronological.length >= 20 ? "full" : "short";
  const maxTokens = reportType === "short" ? 1500 : 4000;
  const patterns = computePatternVariables(entriesChronological);
  const userMessage = buildReportUserMessage(patterns, entriesChronological, "en", reportType);
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildGenderInstruction(userData?.gender)}`;

  const anthropic = new Anthropic();
  let reportTextEn: string;
  try {
    const stream = anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const finalMessage = await stream.finalMessage();
    reportTextEn = finalMessage.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!reportTextEn) {
      console.error(
        "Claude produced no text output. stop_reason:",
        finalMessage.stop_reason,
        "content types:",
        finalMessage.content.map((b) => b.type),
      );
      throw new Error("Empty report");
    }
  } catch (error) {
    console.error("Report generation via Claude failed", error);
    return NextResponse.json({ error: "Report generation failed." }, { status: 500 });
  }

  try {
    await db.collection("users").doc(userId).set(
      {
        report_en: {
          text: reportTextEn,
          type: reportType,
          last_generated_at: FieldValue.serverTimestamp(),
          entry_count: entriesChronological.length,
        },
        // Shared across locales: overwritten on every generation, so it
        // naturally reflects the most recent one.
        report_generated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Failed to save generated report", error);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  // Translation is best-effort: the English report is already saved above,
  // so a translation failure shouldn't fail the whole request.
  try {
    const translationPrompt = buildTranslationPrompt(reportTextEn, userData?.gender);
    const translationMessage = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: Math.ceil(maxTokens * 1.3),
      messages: [{ role: "user", content: translationPrompt }],
    });
    const reportTextRu = translationMessage.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (reportTextRu) {
      await db.collection("users").doc(userId).set(
        {
          report_ru: {
            text: reportTextRu,
            type: reportType,
            last_generated_at: FieldValue.serverTimestamp(),
            entry_count: entriesChronological.length,
          },
        },
        { merge: true },
      );
    } else {
      console.error("Report translation produced no text output");
    }
  } catch (error) {
    console.error("Failed to translate report to Russian", error);
  }

  // Report-ready email — gated per report type (short = 5-entry milestone,
  // full = 20-entry milestone) rather than on report_generated_at existing,
  // since that shared timestamp is already set after the first-ever
  // generation and would otherwise permanently block the 20-entry email.
  // This also naturally prevents a manual refresh from re-sending: by the
  // time a user can refresh, the milestone's email has already gone out and
  // the flag below is already set.
  try {
    const alreadySent = userData?.report_ready_email_sent?.[reportType] === true;
    if (!alreadySent) {
      const userRecord = await getAdminAuth().getUser(userId);
      if (userRecord.email) {
        const emailLocale: "en" | "ru" = userData?.locale === "ru" ? "ru" : "en";
        const content = REPORT_READY_EMAIL_CONTENT[emailLocale][reportType];
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: REPORT_READY_EMAIL_FROM,
          to: userRecord.email,
          subject: content.subject,
          text: content.body,
          html: `<p>${content.body}</p>`,
        });
        if (error) {
          console.error(`Failed to send report-ready email to ${userId}`, error);
        } else {
          await db
            .collection("users")
            .doc(userId)
            .set({ [`report_ready_email_sent.${reportType}`]: true }, { merge: true });
        }
      }
    }
  } catch (error) {
    console.error("Failed to send report-ready email", error);
  }

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();
    const fcmTokens = (userData?.fcm_tokens as string[] | undefined) ?? [];
    const notificationsEnabled = userData?.notifications_enabled === true;

    if (fcmTokens.length > 0 && notificationsEnabled) {
      const messaging = getMessaging(getAdminApp());
      const staleTokens: string[] = [];

      await Promise.all(
        fcmTokens.map(async (token) => {
          try {
            await messaging.send({
              token,
              notification: {
                title: "Your report is ready",
                body: "Your trail has been read. Tap to see your patterns.",
              },
              data: { url: `/${requestedLocale}/report` },
            });
          } catch (error) {
            if ((error as { code?: string }).code === "messaging/registration-token-not-registered") {
              staleTokens.push(token);
            } else {
              console.error(`Failed to send report-ready notification to a token for ${userId}`, error);
            }
          }
        }),
      );

      if (staleTokens.length > 0) {
        await db
          .collection("users")
          .doc(userId)
          .update({ fcm_tokens: FieldValue.arrayRemove(...staleTokens) });
      }
    }
  } catch (error) {
    console.error("Failed to send report-ready notification", error);
  }

  return NextResponse.json({ ok: true });
}
