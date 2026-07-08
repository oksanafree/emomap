import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";
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

  let entriesChronological: ReportEntry[];
  try {
    const db = getAdminDb();
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
    console.error("Failed to fetch entries for report", error);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }

  const patterns = computePatternVariables(entriesChronological);
  const userMessage = buildReportUserMessage(patterns, entriesChronological, locale ?? "en");

  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  let sentAny = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            sentAny = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        if (!sentAny) {
          const finalMessage = await stream.finalMessage();
          console.error(
            "Claude produced no text output. stop_reason:",
            finalMessage.stop_reason,
            "content types:",
            finalMessage.content.map((b) => b.type),
          );
          controller.enqueue(encoder.encode("Could not generate a report. Try again."));
        }
      } catch (error) {
        console.error("Report generation via Claude failed", error);
        if (!sentAny) {
          controller.enqueue(encoder.encode("Could not generate a report. Try again."));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
