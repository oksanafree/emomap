"use client";

import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./return-nudge.module.css";

type ReturnNudgeProps = {
  state: StateKey;
  nudge: string;
};

export function ReturnNudge({ state, nudge }: ReturnNudgeProps) {
  const color = getStateColor(state);

  return (
    <div className={styles.card}>
      <div className={styles.trajectory}>
        <span className={styles.dotFilled} style={{ background: color }} />
        <span className={styles.arrowLine} />
        <span className={styles.dotEmpty} />
      </div>
      <p className={styles.nudgeLine}>{nudge}</p>
    </div>
  );
}
