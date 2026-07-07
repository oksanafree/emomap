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
