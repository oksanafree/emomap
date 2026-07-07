export const ACTIVITY_KEYS = [
  "work",
  "family",
  "socializing",
  "resting",
  "exercise",
  "leisure",
  "scrolling",
  "other",
] as const;
export type ActivityKey = (typeof ACTIVITY_KEYS)[number];

export const SOCIAL_KEYS = ["alone", "withOthers", "online"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SLEEP_KEYS = ["under6", "from6to7", "from7to8", "over8"] as const;
export type SleepKey = (typeof SLEEP_KEYS)[number];

export const ENERGY_KEYS = ["low", "medium", "high"] as const;
export type EnergyKey = (typeof ENERGY_KEYS)[number];

export const HUNGER_KEYS = ["notHungry", "justAte", "hungry", "veryHungry"] as const;
export type HungerKey = (typeof HUNGER_KEYS)[number];
