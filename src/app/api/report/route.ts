import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";
import { computePatternVariables, type ReportEntry, type PatternVariables } from "@/lib/report-patterns";
import { formatReport, type StructuredReport } from "@/lib/report-formatter";
import { formatCustomTokens } from "@/lib/context-labels";

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src/lib/report-writing-rules.md"),
  "utf-8",
);

function buildUserMessage(
  patterns: PatternVariables,
  entries: ReportEntry[],
  locale: string,
): string {
  const payload = {
    entry_count: patterns.entryCount,
    date_range: {
      first: entries[0].timestamp.toISOString().slice(0, 10),
      last: entries[entries.length - 1].timestamp.toISOString().slice(0, 10),
    },
    state_frequency: patterns.stateFrequency,
    most_common_state: patterns.mostCommonState,
    average_position: patterns.averagePosition,
    biggest_shift: patterns.biggestShift,
    entries: entries.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      x: e.x,
      y: e.y,
      state: e.state,
      ...(e.context ? { context: e.context } : {}),
    })),
  };

  const languageInstruction =
    locale === "ru" ? "Write the entire report in Russian." : "Write the entire report in English.";

  return [
    "Generate a 14-entry report following the Fourteen-Entry Report Structure (Section 7) and the Output Format (Section 12) from your instructions.",
    languageInstruction,
    "",
    `Here is this person's check-in data from their most recent ${patterns.entryCount} moments, in chronological order.`,
    "Some moments include an optional \"context\" field with sleep, energy, hunger, activity, social context, and the emotion they logged — apply the Variable-Specific Writing Rules (Section 8) wherever thresholds are met. Moments without a context field simply had none of that logged.",
    "",
    JSON.stringify(payload, null, 2),
    "",
    "Respond with only the JSON object described in the Output Format section — no other text.",
  ].join("\n");
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

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
      .orderBy("timestamp", "desc")
      .limit(14)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No entries found for this user." }, { status: 404 });
    }

    entriesChronological = snapshot.docs
      .map((doc) => {
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
      })
      .reverse();
  } catch (error) {
    console.error("Failed to fetch entries for report", error);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }

  const patterns = computePatternVariables(entriesChronological);
  const userMessage = buildUserMessage(patterns, entriesChronological, locale ?? "en");

  let structured: StructuredReport;
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
    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The report could not be generated." }, { status: 502 });
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(
        "Claude returned no text block. stop_reason:",
        response.stop_reason,
        "content types:",
        response.content.map((b) => b.type),
      );
      return NextResponse.json({ error: "Claude returned no report text." }, { status: 502 });
    }

    try {
      structured = JSON.parse(extractJson(textBlock.text));
    } catch (parseError) {
      console.error("Failed to parse report JSON. Raw text:", textBlock.text);
      throw parseError;
    }
  } catch (error) {
    console.error("Report generation via Claude failed", error);
    return NextResponse.json({ error: "Could not generate report." }, { status: 500 });
  }

  return NextResponse.json({ report: formatReport(structured) });
}
