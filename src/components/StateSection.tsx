"use client";

import { useTranslations } from "next-intl";
import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./state-section.module.css";

type StateSectionProps = {
  state: StateKey;
  body: string;
  isFirstCheckin: boolean;
};

export function StateSection({ state, body, isFirstCheckin }: StateSectionProps) {
  const t = useTranslations("StateCard");
  const color = getStateColor(state);

  return (
    <div className={styles.section}>
      {isFirstCheckin && <p className={styles.firstCheckinCaption}>{t("firstCheckinText")}</p>}
      <p className={styles.description} style={{ borderLeft: `3px solid ${color}`, paddingLeft: 14 }}>
        {body}
      </p>
    </div>
  );
}
