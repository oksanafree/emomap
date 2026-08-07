"use client";

import type { StateKey } from "@/lib/state-detection";
import { RETURN_NUDGE_TITLE, RETURN_NUDGE_BODY } from "@/lib/instant-report";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./return-nudge.module.css";

type ReturnNudgeProps = {
  state: StateKey;
};

export function ReturnNudge({ state }: ReturnNudgeProps) {
  const color = getStateColor(state);

  return (
    <div className={styles.card}>
      <div className={styles.trajectory}>
        <span className={styles.dotFilled} style={{ background: color }} />
        <span className={styles.arrowLine} />
        <span className={styles.dotEmpty} />
      </div>
      <p className={styles.nudgeTitle}>{RETURN_NUDGE_TITLE}</p>
      <p className={styles.nudgeBody}>{RETURN_NUDGE_BODY}</p>
    </div>
  );
}
