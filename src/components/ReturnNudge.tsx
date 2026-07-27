"use client";

import { useTranslations } from "next-intl";
import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./return-nudge.module.css";

type ReturnNudgeProps = {
  state: StateKey;
};

export function ReturnNudge({ state }: ReturnNudgeProps) {
  const t = useTranslations("StateCard");
  const color = getStateColor(state);

  return (
    <div className={styles.card}>
      <div className={styles.trajectory}>
        <span className={styles.dotFilled} style={{ background: color }} />
        <span className={styles.arrowLine} />
        <span className={styles.dotEmpty} />
      </div>
      <p className={styles.nudgeLine}>{t(`states.${state}.returnNudge`)}</p>
      <p className={styles.anchorLine}>{t("returnAnchor")}</p>
    </div>
  );
}
