export const STATE_KEYS = [
  "Building",
  "Protecting",
  "Receiving",
  "Enduring",
  "Opening",
  "Bracing",
  "Seeking",
  "Drifting",
  "Still",
] as const;

export type StateKey = (typeof STATE_KEYS)[number];

// Still requires both axes genuinely at rest — a tight box at center, not
// just a nearby radius. Opening/Bracing/Seeking/Drifting share that same
// inner threshold, so they pick up exactly the room Still gives up.
const STILL_THRESHOLD = 0.1;

export function detectState(x: number, y: number): StateKey {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax < STILL_THRESHOLD && ay < STILL_THRESHOLD) return "Still";
  if (ay < STILL_THRESHOLD && ax >= STILL_THRESHOLD) return x > 0 ? "Opening" : "Bracing";
  if (ax < STILL_THRESHOLD && ay >= STILL_THRESHOLD) return y > 0 ? "Seeking" : "Drifting";
  if (x >= 0 && y >= 0) return "Building";
  if (x < 0 && y >= 0) return "Protecting";
  if (x >= 0 && y < 0) return "Receiving";
  return "Enduring";
}

export type Intensity = "low" | "medium" | "high";

// Distance from center, normalized against the farthest reachable point
// (a corner of the [-1,1] square, at distance sqrt(2) ≈ 1.41).
export function computeIntensity(x: number, y: number): Intensity {
  const normalized = Math.sqrt(x * x + y * y) / Math.SQRT2;
  if (normalized < 0.33) return "low";
  if (normalized <= 0.66) return "medium";
  return "high";
}
