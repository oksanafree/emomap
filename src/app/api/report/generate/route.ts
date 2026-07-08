import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { computePatternVariables, type ReportEntry } from "@/lib/report-patterns";
import { formatCustomTokens } from "@/lib/context-labels";
import { SYSTEM_PROMPT, buildReportUserMessage } from "@/lib/report-prompt";

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let locale: string | undefined;
  try {
    const body = await request.json();
    userId = body.userId;
    locale = body.locale;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const db = getAdminDb();

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

  const patterns = computePatternVariables(entriesChronological);
  const userMessage = buildReportUserMessage(patterns, entriesChronological, locale ?? "en");

  let reportText: string;
  try {
    const anthropic = new Anthropic();
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const finalMessage = await stream.finalMessage();
    reportText = finalMessage.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!reportText) {
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
        report: {
          text: reportText,
          generated_at: FieldValue.serverTimestamp(),
          entry_count: entriesChronological.length,
        },
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Failed to save generated report", error);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();
    const fcmToken = userData?.fcm_token as string | undefined;
    const notificationsEnabled = userData?.notifications_enabled === true;

    if (fcmToken && notificationsEnabled) {
      await getMessaging(getAdminApp()).send({
        token: fcmToken,
        notification: {
          title: "Your Emomapp report is ready",
          body: "Your trail has been read. Tap to see your patterns.",
        },
        data: { url: `/${locale ?? "en"}/report` },
      });
    }
  } catch (error) {
    console.error("Failed to send report-ready notification", error);
  }

  return NextResponse.json({ ok: true });
}
