export const ACTIVITY_KEYS = [
  "work",
  "study",
  "exercise",
  "resting",
  "creative",
  "chores",
  "eating",
  "caregiving",
  "commuting",
] as const;
export type ActivityKey = (typeof ACTIVITY_KEYS)[number];

export const SOCIAL_KEYS = ["alone", "withOthers", "online"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const LOCATION_KEYS = ["home", "work", "outside", "commuting", "traveling", "elsewhere"] as const;
export type LocationKey = (typeof LOCATION_KEYS)[number];
