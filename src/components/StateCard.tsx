"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./state-card.module.css";

const FIRST_CHECKIN_TEXT_MS = 1200;

type StateCardProps = {
  state: StateKey;
  emotion: string;
  isFirstCheckin: boolean;
  onContinue: () => void;
};

export function StateCard({ state, emotion, isFirstCheckin, onContinue }: StateCardProps) {
  const t = useTranslations("StateCard");
  const locale = useLocale();
  const color = getStateColor(state);
  const [showFirstCheckinText, setShowFirstCheckinText] = useState(isFirstCheckin);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirstCheckin) return;
    const timeout = setTimeout(() => setShowFirstCheckinText(false), FIRST_CHECKIN_TEXT_MS);
    return () => clearTimeout(timeout);
  }, [isFirstCheckin]);

  useEffect(() => {
    if (!emotion) return;
    let cancelled = false;
    fetch("/api/state-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, emotion, locale }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.note) setNote(data.note);
      })
      .catch((err) => {
        console.error("Failed to fetch state note", err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, emotion, locale]);

  if (showFirstCheckinText) {
    return (
      <div className={styles.firstCheckinScreen}>
        <p className={styles.firstCheckinText}>{t("firstCheckinText")}</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={`${styles.fadeItem} ${styles.stateName}`} style={{ color }}>
        {t(`states.${state}.header`)}
      </h1>
      <p className={`${styles.fadeItem} ${styles.description}`}>{t(`states.${state}.description`)}</p>
      {emotion && note && (
        <p className={`${styles.fadeItem} ${styles.note}`} style={{ borderLeftColor: color }}>
          {note}
        </p>
      )}
      <p className={`${styles.fadeItem} ${styles.question}`}>{t(`states.${state}.question`)}</p>
      <button type="button" className={`${styles.fadeItem} ${styles.continueBtn}`} onClick={onContinue}>
        {t("continue")}
      </button>
    </div>
  );
}
