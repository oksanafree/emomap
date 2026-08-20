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
// Russian-specific writing rules, applied only to the Russian report (the
// translation output). Kept as a labeled block so the model reads it as a
// coherent style guide rather than one flattened instruction.
const RUSSIAN_LANGUAGE_STYLE = `RUSSIAN LANGUAGE STYLE

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

export function buildTranslationPrompt(englishReport: string, gender: string | undefined): string {
  const genderDescription =
    gender === "female"
      ? "female"
      : gender === "male"
        ? "male"
        : "of unspecified gender — use gender-neutral or plural Russian forms where possible";

  const instruction = [
    "Translate the following psychological pattern report into Russian, following the RUSSIAN LANGUAGE STYLE rules below.",
    `The user is ${genderDescription}.`,
    "Use grammatically correct Russian verb forms and adjectives that match the user's gender throughout (e.g. \"двигалась\" not \"двигался\" for a female user).",
    "Preserve the report's section labels and the order of its sections.",
    "Use the following Russian names for the quadrant states: BUILDING → СТРОЮ, PROTECTING → ЗАЩИЩАЮ, RECEIVING → ПРИНИМАЮ, ENDURING → ТЕРПЛЮ, SEEKING → ИЩУ, DRIFTING → ДРЕЙФУЮ, BRACING → СЖИМАЮСЬ, OPENING → ОТКРЫВАЮСЬ, STILL → ТИШИНА.",
    "Keep the analysis and findings faithful — do not add, remove, or reinterpret them — but render everything in natural Russian per the style rules below, not a literal word-for-word translation.",
    "Output only the Russian translation — do not include the original English text or any English.",
  ].join(" ");

  return `${instruction}\n\n${RUSSIAN_LANGUAGE_STYLE}\n\n${englishReport}`;
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
