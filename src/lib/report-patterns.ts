import { STATE_KEYS, type StateKey } from "@/lib/state-detection";

export type ReportEntry = {
  timestamp: Date;
  world_value: number;
  self_value: number;
  x: number;
  y: number;
  state: StateKey;
  context: string | null;
};

export type PatternVariables = {
  entryCount: number;
  stateFrequency: Record<StateKey, number>;
  mostCommonState: StateKey;
  averagePosition: { x: number; y: number };
  biggestShift: {
    from: { x: number; y: number; state: StateKey; timestamp: string };
    to: { x: number; y: number; state: StateKey; timestamp: string };
  };
};

export function computePatternVariables(
  entriesChronological: ReportEntry[],
): PatternVariables {
  const stateFrequency = Object.fromEntries(
    STATE_KEYS.map((key) => [key, 0]),
  ) as Record<StateKey, number>;

  let sumX = 0;
  let sumY = 0;

  for (const entry of entriesChronological) {
    stateFrequency[entry.state] += 1;
    sumX += entry.x;
    sumY += entry.y;
  }

  const mostCommonState = STATE_KEYS.reduce((best, key) =>
    stateFrequency[key] > stateFrequency[best] ? key : best,
  );

  const first = entriesChronological[0];
  const last = entriesChronological[entriesChronological.length - 1];

  return {
    entryCount: entriesChronological.length,
    stateFrequency,
    mostCommonState,
    averagePosition: {
      x: sumX / entriesChronological.length,
      y: sumY / entriesChronological.length,
    },
    biggestShift: {
      from: {
        x: first.x,
        y: first.y,
        state: first.state,
        timestamp: first.timestamp.toISOString(),
      },
      to: {
        x: last.x,
        y: last.y,
        state: last.state,
        timestamp: last.timestamp.toISOString(),
      },
    },
  };
}
