import type { ActivityKey, EngagementLevel, SocialKey } from "@/lib/context-options";

const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  work: "Work",
  study: "Study",
  exercise: "Exercise",
  resting: "Resting",
  creative: "Creative",
  caregiving: "Caregiving",
  outside: "Outside",
  traveling: "Traveling",
};

const SOCIAL_LABELS: Record<SocialKey, string> = {
  alone: "Alone",
  withOthers: "With others",
  online: "Online",
};

const ENGAGEMENT_LABELS: Record<EngagementLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type CustomTokens = {
  emotion?: string;
  activity?: string[] | string;
  social?: string[] | string;
  mental_engagement?: string;
  physical_engagement?: string;
  sleep?: number;
  energy?: number;
  hunger?: number;
  note?: string;
  body_note?: string;
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

  if (typeof tokens.sleep === "number") {
    parts.push(`Sleep: ${tokens.sleep}h`);
  }
  if (typeof tokens.energy === "number") {
    parts.push(`Energy: ${tokens.energy}/10`);
  }
  if (typeof tokens.hunger === "number") {
    parts.push(`Hunger: ${tokens.hunger}/10`);
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

  if (tokens.mental_engagement && tokens.mental_engagement in ENGAGEMENT_LABELS) {
    parts.push(`Mental engagement: ${ENGAGEMENT_LABELS[tokens.mental_engagement as EngagementLevel]}`);
  }
  if (tokens.physical_engagement && tokens.physical_engagement in ENGAGEMENT_LABELS) {
    parts.push(`Physical engagement: ${ENGAGEMENT_LABELS[tokens.physical_engagement as EngagementLevel]}`);
  }

  const tokenLine = parts.length > 0 ? parts.join(" · ") : null;

  const note = typeof tokens.note === "string" ? tokens.note.trim() : "";
  const noteLine = note ? `Note: "${note}"` : null;

  const bodyNote = typeof tokens.body_note === "string" ? tokens.body_note.trim() : "";
  const bodyLine = bodyNote ? `Body: "${bodyNote}"` : null;

  if (!tokenLine && !noteLine && !bodyLine) return null;
  return [tokenLine, bodyLine, noteLine].filter((line): line is string => Boolean(line)).join("\n");
}
