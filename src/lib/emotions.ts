import type { StateKey } from "@/lib/state-detection";

export const EMOTIONS: Record<StateKey, string[]> = {
  Building: ["Inspired", "Hopeful", "Confident", "Energized", "Proud", "Joyful"],
  Protecting: ["Frustrated", "Determined", "Alert", "Defensive", "Irritated", "Impatient"],
  Receiving: ["At ease", "Nostalgic", "Trusting", "Peaceful", "Relaxed", "Receptive"],
  Enduring: ["Anxious", "Exhausted", "Sad", "Numb", "Hopeless", "Resigned"],
  Opening: ["Curious", "Expectant", "Hopeful", "Tentative"],
  Bracing: ["Wary", "Tense", "Alert", "Uncertain"],
  Seeking: ["Restless", "Driven", "Focused", "Unsure"],
  Drifting: ["Floating", "Calm", "Disconnected", "Unclear"],
  Still: ["Mixed", "Uncertain", "Peaceful", "Numb"],
};
