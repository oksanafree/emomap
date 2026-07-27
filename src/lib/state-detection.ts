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

export function detectState(x: number, y: number): StateKey {
  const r = Math.sqrt(x * x + y * y) / Math.sqrt(2);
  if (r < 0.18) return "Still";
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ay < 0.12 && ax >= 0.12) return x > 0 ? "Opening" : "Bracing";
  if (ax < 0.12 && ay >= 0.12) return y > 0 ? "Seeking" : "Drifting";
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
