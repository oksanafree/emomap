export const GENDER_KEYS = ["male", "female", "non-binary", "unspecified"] as const;
export type GenderKey = (typeof GENDER_KEYS)[number];

export const AGE_RANGE_KEYS = ["under18", "18-24", "25-34", "35-44", "45-54", "55+"] as const;
export type AgeRangeKey = (typeof AGE_RANGE_KEYS)[number];
