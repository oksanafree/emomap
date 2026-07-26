import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";

const STATE_DESCRIPTIONS: Record<string, string> = {
  Building: "The situation is working with them and they're actively shaping it",
  Protecting: "Pressing situation, actively holding ground and managing it",
  Receiving: "Something supportive is available and they're open to it",
  Enduring: "Something pressing is happening and their capacity to change it is limited right now",
  Opening: "Ready to act but the situation isn't fully clear yet",
  Bracing: "Something pressing is real or possible; alert, preparing",
  Seeking: "Something supportive is nearby; reaching toward it",
  Drifting: "Situation is unclear; not pushing, suspended, waiting",
  Still: "Neither pressing nor giving; neither acting nor yielding — a pause",
};

const SYSTEM_PROMPT = `You generate brief, warm observations for a psychological self-awareness app.
The user has just mapped their current state and named the emotion they're feeling.

Rules:
- 1-2 sentences maximum, under 40 words total
- Warm, present-tense, like a wise friend — not a therapist
- Connect the emotion to the state naturally, making the combination feel seen
- Do NOT use words like: indicates, suggests, tends to, pattern, your history, you often
- Do NOT diagnose, interpret, or project
- Do NOT be congratulatory or motivational
- If locale is "ru", respond in Russian`;

// Serverless instances are ephemeral, so an in-memory cache wouldn't
// reliably prevent duplicate calls for the same combination across
// invocations — persist in Firestore instead, keyed by a hash of
// state+emotion+locale (hashed rather than used raw so arbitrary user-typed
// emotion text, including Cyrillic and punctuation, always makes a safe,
// bounded-length Firestore document ID).
function cacheKeyFor(state: string, emotion: string, locale: string): string {
  return createHash("sha256").update(`${state}::${emotion}::${locale}`).digest("hex");
}

export async function POST(request: NextRequest) {
  let state: string | undefined;
  let emotion: string | undefined;
  let locale: unknown;
  try {
    const body = await request.json();
    state = body.state;
    emotion = body.emotion;
    locale = body.locale;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!state || !emotion) {
    return NextResponse.json({ error: "state and emotion are required." }, { status: 400 });
  }

  const description = STATE_DESCRIPTIONS[state];
  if (!description) {
    return NextResponse.json({ error: "Unknown state." }, { status: 400 });
  }

  const resolvedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";

  const db = getAdminDb();
  const cacheKey = cacheKeyFor(state, emotion, resolvedLocale);
  const cacheRef = db.collection("state_note_cache").doc(cacheKey);

  try {
    const cached = await cacheRef.get();
    const cachedNote = cached.data()?.note;
    if (typeof cachedNote === "string" && cachedNote) {
      return NextResponse.json({ note: cachedNote });
    }
  } catch (error) {
    console.error("Failed to read state-note cache", error);
    // Non-fatal — fall through and generate a fresh note.
  }

  const userMessage = [
    `State: ${state}`,
    `State meaning: ${description}`,
    `Emotion the user chose: ${emotion}`,
    `Locale: ${resolvedLocale}`,
    "",
    "Write the observation.",
  ].join("\n");

  let note: string;
  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    note = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!note) throw new Error("Empty note");
  } catch (error) {
    console.error("Failed to generate state note", error);
    return NextResponse.json({ error: "Could not generate note." }, { status: 500 });
  }

  try {
    await cacheRef.set({
      note,
      state,
      emotion,
      locale: resolvedLocale,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to write state-note cache", error);
    // Non-fatal — the note was already generated successfully.
  }

  return NextResponse.json({ note });
}
