export const ACTIVITY_KEYS = [
  "work",
  "study",
  "exercise",
  "resting",
  "creative",
  "caregiving",
  "outside",
  "traveling",
] as const;
export type ActivityKey = (typeof ACTIVITY_KEYS)[number];

export const SOCIAL_KEYS = ["alone", "withOthers", "online"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const ENGAGEMENT_KEYS = ["low", "medium", "high"] as const;
export type EngagementLevel = (typeof ENGAGEMENT_KEYS)[number];
