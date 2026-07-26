// Firestore actually stores the capitalized StateKey values ("Building",
// "Protecting", ...) — not lowercase as originally assumed — so lookups
// always go through getStateColor() below, which normalizes case instead
// of relying on callers to pass the right casing.
export const STATE_COLORS: Record<string, string> = {
  building: "#D4A853",
  protecting: "#C0392B",
  receiving: "#48A999",
  enduring: "#7B8FA1",
  opening: "#E8C547",
  bracing: "#5B4C8A",
  seeking: "#E07B54",
  drifting: "#8BAFC0",
  still: "#C4B9AC",
};

const DEFAULT_STATE_COLOR = "#8a8680";

export function getStateColor(state: string | null | undefined): string {
  if (!state) return DEFAULT_STATE_COLOR;
  return STATE_COLORS[state.toLowerCase()] ?? DEFAULT_STATE_COLOR;
}
