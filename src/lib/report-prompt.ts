import fs from "fs";
import path from "path";
import type { PatternVariables, ReportEntry } from "@/lib/report-patterns";

export const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src/lib/report-writing-rules.md"),
  "utf-8",
);

export function buildGenderInstruction(gender: string | undefined): string {
  if (gender === "female") {
    return "The user is female. In Russian, use feminine grammatical forms throughout (чувствовала, была, уверена, etc.)";
  }
  if (gender === "male") {
    return "The user is male. Use masculine forms (чувствовал, был, уверен, etc.)";
  }
  return "Use gender-neutral or plural forms where possible in Russian.";
}

// Translation only — never re-analyzes the data. Generating the report once
// in English and translating it keeps the two languages structurally and
// substantively identical instead of producing two independently-written
// analyses that can disagree with each other.
export function buildTranslationPrompt(englishReport: string, gender: string | undefined): string {
  const genderDescription =
    gender === "female"
      ? "female"
      : gender === "male"
        ? "male"
        : "of unspecified gender — use gender-neutral or plural Russian forms where possible";

  const instruction = [
    "Translate the following psychological pattern report into Russian.",
    `The user is ${genderDescription}.`,
    "Use grammatically correct Russian verb forms and adjectives that match the user's gender throughout (e.g. \"двигалась\" not \"двигался\" for a female user).",
    "Preserve all section headings, formatting, and structure exactly.",
    "Use the following Russian names for the quadrant states: BUILDING → СТРОЮ, PROTECTING → ЗАЩИЩАЮ, RECEIVING → ПРИНИМАЮ, ENDURING → ТЕРПЛЮ, SEEKING → ИЩУ, DRIFTING → ДРЕЙФУЮ, BRACING → СЖИМАЮСЬ, OPENING → ОТКРЫВАЮСЬ, STILL → ТИШИНА.",
    "Do not add, remove, or reinterpret any content — translate only.",
  ].join(" ");

  return `${instruction}\n\n${englishReport}`;
}

export function buildReportUserMessage(
  patterns: PatternVariables,
  entries: ReportEntry[],
  locale: string,
  type: "short" | "full",
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

  const structureInstructions =
    type === "short"
      ? [
          "Generate a short report following the Five-Entry Insight Structure (Section 6) and the content guidance in the Output Format (Section 13) from your instructions.",
          languageInstruction,
          "",
          "This response streams to the reader word by word as you write it, so write the report as the final text directly — plain paragraphs, not the JSON structure from Section 13.",
          "Open with the pattern statement as a lead paragraph, no heading.",
          "Write the three angles (what the map shows, what this reveals, something to watch) as connected flowing paragraphs, in that order — no capitalized labels or headings. This report is under 20 entries, and section headers are reserved for reports that long or longer.",
          "Follow with any axis note or distortion flag as plain paragraphs if they apply.",
          "After the last paragraph, add the closing encouragement line described at the end of Section 6, as its own short paragraph.",
          "Separate every paragraph with a single blank line. Do not use markdown formatting (no #, *, or backticks) and do not wrap anything in JSON.",
        ]
      : [
          "Generate a full report following the Fourteen-Entry Report Structure (Section 7) and the content guidance in the Output Format (Section 13) from your instructions.",
          languageInstruction,
          "",
          "This response streams to the reader word by word as you write it, so write the report as the final text directly — plain paragraphs, not the JSON structure from Section 13.",
          "Open with the pattern statement as a lead paragraph, no heading.",
          "For each finding, put its short label in capital letters alone on its own line, then the finding's text on the next line.",
          "If there is a map story, give it its own paragraph (no heading). Follow with any axis note or distortion flag as plain paragraphs if they apply.",
          "Close with the something-to-sit-with line by itself. Do not add any closing encouragement line after it — full reports never include one.",
          "Separate every paragraph and labeled finding with a single blank line. Do not use markdown formatting (no #, *, or backticks) and do not wrap anything in JSON.",
        ];

  return [
    ...structureInstructions,
    "",
    `Here is this person's check-in data from their most recent ${patterns.entryCount} moments, in chronological order.`,
    "Some moments include an optional \"context\" field with sleep, energy, hunger, activity, social context, and the emotion they logged — apply the Variable-Specific Writing Rules (Section 8) wherever thresholds are met. Moments without a context field simply had none of that logged.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
