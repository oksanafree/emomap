"use client";

import { useTranslations } from "next-intl";
import styles from "./checkin-countdown.module.css";

const FIRST_REPORT_ENTRIES = 5;
const FULL_REPORT_ENTRIES = 20;

type CheckinCountdownProps = {
  entryCount: number;
  color: string;
};

export function CheckinCountdown({ entryCount, color }: CheckinCountdownProps) {
  const t = useTranslations("History");

  if (entryCount >= FULL_REPORT_ENTRIES) return null;

  const isEarly = entryCount < FIRST_REPORT_ENTRIES;
  const remaining = isEarly ? FIRST_REPORT_ENTRIES - entryCount : FULL_REPORT_ENTRIES - entryCount;
  const label = isEarly ? t("countdownFirstReport", { remaining }) : t("countdownFullReport", { remaining });

  return (
    <div className={styles.wrap}>
      <div className={styles.number} style={{ color }}>
        {remaining}
      </div>
      <p className={styles.label}>{label}</p>
      {isEarly && <p className={styles.subtext}>{t("countdownSubtextEarly")}</p>}
    </div>
  );
}
