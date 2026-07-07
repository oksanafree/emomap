import type { ActivityKey, EnergyKey, HungerKey, SleepKey, SocialKey } from "@/lib/context-options";

const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  work: "Work/Study",
  family: "Family",
  socializing: "Socializing",
  resting: "Resting",
  exercise: "Exercise",
  leisure: "Leisure",
  scrolling: "Scrolling",
  other: "Other",
};

const SOCIAL_LABELS: Record<SocialKey, string> = {
  alone: "Alone",
  withOthers: "With others",
  online: "Online",
};

const SLEEP_LABELS: Record<SleepKey, string> = {
  under6: "Under 6h",
  from6to7: "6–7h",
  from7to8: "7–8h",
  over8: "8h+",
};

const ENERGY_LABELS: Record<EnergyKey, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const HUNGER_LABELS: Record<HungerKey, string> = {
  notHungry: "Not hungry",
  justAte: "Just ate",
  hungry: "Hungry",
  veryHungry: "Very hungry",
};

export type CustomTokens = {
  emotion?: string;
  activity?: string[] | string;
  social?: string[] | string;
  sleep?: string;
  energy?: string;
  hunger?: string;
};

// Older entries stored `activity`/`social` as a single string before those
// fields became multi-select arrays. Normalize either shape defensively so
// legacy Firestore data doesn't throw when generating a report.
function toArray(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) return [value];
  return [];
}

export function formatCustomTokens(tokens: CustomTokens | undefined | null): string | null {
  if (!tokens) return null;
  const parts: string[] = [];

  if (tokens.sleep && tokens.sleep in SLEEP_LABELS) {
    parts.push(`Sleep: ${SLEEP_LABELS[tokens.sleep as SleepKey]}`);
  }
  if (tokens.energy && tokens.energy in ENERGY_LABELS) {
    parts.push(`Energy: ${ENERGY_LABELS[tokens.energy as EnergyKey]}`);
  }
  if (tokens.hunger && tokens.hunger in HUNGER_LABELS) {
    parts.push(`Hunger: ${HUNGER_LABELS[tokens.hunger as HungerKey]}`);
  }
  if (tokens.emotion) {
    parts.push(`Feeling: ${tokens.emotion}`);
  }

  const activityLabels = toArray(tokens.activity)
    .filter((a): a is ActivityKey => a in ACTIVITY_LABELS)
    .map((a) => ACTIVITY_LABELS[a]);
  if (activityLabels.length > 0) parts.push(`Doing: ${activityLabels.join(", ")}`);

  const socialLabels = toArray(tokens.social)
    .filter((s): s is SocialKey => s in SOCIAL_LABELS)
    .map((s) => SOCIAL_LABELS[s]);
  if (socialLabels.length > 0) parts.push(`With: ${socialLabels.join(", ")}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}
