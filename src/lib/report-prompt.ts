import fs from "fs";
import path from "path";
import type { PatternVariables, ReportEntry } from "@/lib/report-patterns";

export const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src/lib/report-writing-rules.md"),
  "utf-8",
);

export function buildGenderInstruction(gender: string | undefined): string {
  // Accepts the current Settings values ("f"/"m"/null) and the legacy signup
  // values ("female"/"male"); anything else is treated as unspecified.
  if (gender === "f" || gender === "female") {
    return "The user is female. Use feminine grammatical forms throughout (ощущала, чувствовала, одна, etc.).";
  }
  if (gender === "m" || gender === "male") {
    return "The user is male. Use masculine grammatical forms throughout (ощущал, чувствовал, один, etc.).";
  }
  return "The user's gender is unspecified. Use gender-neutral constructions; do not assume a gender.";
}

// The Russian report is written independently from the same check-in data (not
// a translation of the English report), so it reads as natural Russian. These
// exports compose the Russian generation's system prompt in the API route.

// Leads the Russian system prompt: write in Russian from scratch, don't translate.
export const RUSSIAN_REPORT_INTRO =
  "Write this report in Russian. Do not translate from English. Write it as an original Russian text — use natural Russian sentence structures, Russian emotional vocabulary, and Russian rhythm. The data is the same as for the English report, but your writing should feel as if you thought in Russian from the start.";

// The Russian names for the quadrant/edge states, used in the Russian report.
export const RUSSIAN_STATE_NAMES =
  "Use the following Russian names for the quadrant states: BUILDING → СТРОЮ, PROTECTING → ЗАЩИЩАЮ, RECEIVING → ПРИНИМАЮ, ENDURING → ТЕРПЛЮ, SEEKING → ИЩУ, DRIFTING → ДРЕЙФУЮ, BRACING → СЖИМАЮСЬ, OPENING → ОТКРЫВАЮСЬ, STILL → ТИШИНА.";

// Russian-specific writing rules. Kept as a labeled block so the model reads it
// as a coherent style guide rather than one flattened instruction.
export const RUSSIAN_LANGUAGE_STYLE = `RUSSIAN LANGUAGE STYLE

Write in natural Russian. Do not translate English constructions literally. Specific rules:

1. USE "ТЫ" THROUGHOUT. Never use "вы". No exceptions.

2. VOCABULARY PREFERENCES:
   - "уверенность в своих силах" not "ощущение способности и направленности"
   - "бессилие" not "нет ресурсов, чтобы справиться"
   - "рушиться" not "падать" when describing sudden energy crashes
   - "восстанавливаться" not "возвращаться" when describing recovery
   - "затянувшееся общение" not "продолжительное взаимодействие"
   - "поддержка / помеха" not "сотрудничество / давление" for situation appraisal
   - "замедление" not "остановка" when referring to slowing down or pausing
   - "состояние [emotion]" not "моменты, склонявшиеся к [emotion]"

3. SENTENCE LENGTH. Break long sentences. If a sentence contains more than two clauses, split it.

4. NO GENDER SPLITS. Never write "умён/умна" or similar. Use gender-neutral constructions.

5. WHEN DATA IS LIMITED. If the data doesn't fully explain a pattern, do not write "данные не могут полностью назвать." Instead write: "возможно, больше записей помогут понять, что именно на это влияет — продолжай отмечать свои состояния." This is the natural place to invite the user to keep logging.

6. NO SUMMARY PARAGRAPH. Do not add a paragraph summarizing the arc of the period before the closing question. Go directly from the last section to the closing question.

7. CLOSING QUESTION. Must use "замедление" not "остановка" when asking about the user's difficulty with slowing down.`;

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
          "After the last paragraph, close with one open question (something to sit with, not encouragement or advice), as its own short paragraph.",
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
