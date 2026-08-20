"use client";

import type { StateKey } from "@/lib/state-detection";
import { RETURN_NUDGE_TITLE, RETURN_NUDGE_BODY } from "@/lib/instant-report";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./return-nudge.module.css";

type ReturnNudgeProps = {
  state: StateKey;
  // When set (Russian), render this single per-tier "come back" line instead
  // of the fixed two-line English nudge.
  line?: string;
};

export function ReturnNudge({ state, line }: ReturnNudgeProps) {
  const color = getStateColor(state);

  return (
    <div className={styles.card}>
      <div className={styles.trajectory}>
        <span className={styles.dotFilled} style={{ background: color }} />
        <span className={styles.arrowLine} />
        <span className={styles.dotEmpty} />
      </div>
      {line ? (
        <p className={styles.nudgeTitle}>{line}</p>
      ) : (
        <>
          <p className={styles.nudgeTitle}>{RETURN_NUDGE_TITLE}</p>
          <p className={styles.nudgeBody}>{RETURN_NUDGE_BODY}</p>
        </>
      )}
    </div>
  );
}
