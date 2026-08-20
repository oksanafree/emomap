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
  RUSSIAN_LANGUAGE_STYLE,
  RUSSIAN_REPORT_INTRO,
  RUSSIAN_STATE_NAMES,
  buildGenderInstruction,
  buildReportUserMessage,
} from "@/lib/report-prompt";

// Same verified Resend sending domain used by the welcome/reminder emails in
// functions/src/index.ts.
const REPORT_READY_EMAIL_FROM = "Emomapp <reminder@mail.emomapp.app>";

// Manual refreshes (source: "manual" from the report page's Refresh button)
// are capped to once per 24h per user. Automatic milestone generations
// (5, 20, 40, … check-ins) pass no source and are never rate-limited.
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// TEMP (testing): the 24h manual-refresh cap is disabled so the Russian report
// can be regenerated freely during testing. RESTORE to `true` when done. The
// client-side guard in report/page.tsx is disabled with the same flag.
const MANUAL_REFRESH_RATE_LIMIT_ENABLED = false;

// Editorial style guide, prepended to the report-writing rules so it frames
// how the model writes before it reaches the detailed data/structure rules.
const WRITING_STYLE = `WRITING STYLE

You are writing a personal pattern report, not a summary. Your job is to find what the data reveals that the person could not have seen themselves — and say it plainly.

Rules:

1. State each insight once, with its full weight. Do not restate it in the sentences that follow.

2. End every section at the height of its finding. If something is surprising or counterintuitive, close there — don't trail off into neutral description.

3. Be specific, not abstract. Prefer "the situation felt hostile every time energy dropped to 2" over "your perception of circumstances was affected by low energy states."

4. If the user wrote something in their own words — especially self-criticism, surprise, or a raw observation — treat it as the most important data point in that section. Quote it directly and build the finding around it.

5. Do not repeat the same observation in different words within a paragraph or across sections.

6. Close the entire report with one open question. The question should create productive uncertainty — it should not answer itself, resolve anything, or suggest what the person should do. It should point at something the data cannot fully explain.

7. Write in second person ("you"), past tense for events, present tense for patterns.

8. No bullet points. No headers within sections. Capitalized section labels on their own line are allowed. Flowing prose only.

9. Cross-reference contradictions. When the same variable — a person, activity, or context — appears at both the high and low ends of the data, name that contradiction explicitly, within a single section. Do not split the two ends across different sections.`;

// Push-notification copy for the report-ready alert, keyed by the requested
// locale (same source of truth as the deep-link URL below).
const REPORT_READY_PUSH_CONTENT: Record<"en" | "ru", { title: string; body: string }> = {
  en: {
    title: "Your report is ready",
    body: "Your trail has been read. Tap to see your patterns.",
  },
  ru: {
    title: "Твой отчёт готов",
    body: "Твой путь прочитан. Нажми, чтобы увидеть свои паттерны.",
  },
};

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
  let source: unknown;
  try {
    const body = await request.json();
    userId = body.userId;
    locale = body.locale;
    type = body.type;
    source = body.source;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const isManualRefresh = source === "manual";

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

  // Enforce the once-per-24h manual-refresh cap before spending any Claude
  // calls. The report page mirrors this in the UI, but this is the
  // authoritative gate — it can't be bypassed from the client.
  if (isManualRefresh && MANUAL_REFRESH_RATE_LIMIT_ENABLED) {
    const lastRefreshed = userData?.report_last_refreshed_at;
    const lastRefreshedMs =
      lastRefreshed && typeof lastRefreshed.toMillis === "function" ? lastRefreshed.toMillis() : null;
    if (lastRefreshedMs !== null && Date.now() - lastRefreshedMs < REFRESH_COOLDOWN_MS) {
      return NextResponse.json({ error: "Report can be refreshed once per 24 hours." }, { status: 429 });
    }
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

  // Both language reports are generated independently from the same check-in
  // data below (the Russian report is written from scratch, not translated).
  // The requested locale only controls which saved version the push
  // notification links to.
  const requestedLocale = locale === "ru" ? "ru" : "en";
  const reportType: "short" | "full" =
    type === "short" || type === "full" ? type : entriesChronological.length >= 20 ? "full" : "short";
  const maxTokens = reportType === "short" ? 1500 : 4000;
  const patterns = computePatternVariables(entriesChronological);
  const userMessage = buildReportUserMessage(patterns, entriesChronological, "en", reportType);
  // English-only guard. Gender/Russian handling belongs to the separate Russian
  // generation below — injecting a "use Russian forms" instruction here made the
  // model emit Russian inside the English report, so report_en held both.
  const systemPrompt = `${WRITING_STYLE}\n\n${SYSTEM_PROMPT}\n\nWrite this report entirely in English. Do not include any Russian text — the Russian version is generated separately.`;

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
    const reportSave: Record<string, unknown> = {
      report_en: {
        text: reportTextEn,
        type: reportType,
        last_generated_at: FieldValue.serverTimestamp(),
        entry_count: entriesChronological.length,
      },
      // Shared across locales: overwritten on every generation, so it
      // naturally reflects the most recent one.
      report_generated_at: FieldValue.serverTimestamp(),
    };
    // Only a successful manual refresh consumes the daily allowance; automatic
    // milestone generations don't touch this field.
    if (isManualRefresh) {
      reportSave.report_last_refreshed_at = FieldValue.serverTimestamp();
    }
    await db.collection("users").doc(userId).set(reportSave, { merge: true });
  } catch (error) {
    console.error("Failed to save generated report", error);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  // The Russian report is written independently from the same data (not a
  // translation), so it reads as natural Russian. Best-effort: the English
  // report is already saved above, so a Russian failure doesn't fail the request.
  try {
    const russianSystemPrompt = `${RUSSIAN_REPORT_INTRO}\n\n${WRITING_STYLE}\n\n${SYSTEM_PROMPT}\n\n${RUSSIAN_LANGUAGE_STYLE}\n\n${RUSSIAN_STATE_NAMES}\n\n${buildGenderInstruction(userData?.gender)}`;
    // Russian prose runs longer than English for the same content, so give the
    // output extra headroom.
    const russianStream = anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: Math.ceil(maxTokens * 1.3),
      system: russianSystemPrompt,
      messages: [{ role: "user", content: buildReportUserMessage(patterns, entriesChronological, "ru", reportType) }],
    });
    const russianFinal = await russianStream.finalMessage();
    const reportTextRu = russianFinal.content
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
      console.error("Russian report generation produced no text output");
    }
  } catch (error) {
    console.error("Failed to generate Russian report", error);
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
                title: REPORT_READY_PUSH_CONTENT[requestedLocale].title,
                body: REPORT_READY_PUSH_CONTENT[requestedLocale].body,
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
