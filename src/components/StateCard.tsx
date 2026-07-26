"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./state-card.module.css";

const FIRST_CHECKIN_TEXT_MS = 1200;
const NOTE_MIN_DELAY_MS = 600;
const NOTE_FETCH_TIMEOUT_MS = 4000;

type StateCardProps = {
  state: StateKey;
  emotion: string;
  isFirstCheckin: boolean;
  showQuestion: boolean;
  onContinue: () => void;
};

export function StateCard({ state, emotion, isFirstCheckin, showQuestion, onContinue }: StateCardProps) {
  const t = useTranslations("StateCard");
  const locale = useLocale();
  const color = getStateColor(state);
  const [showFirstCheckinText, setShowFirstCheckinText] = useState(isFirstCheckin);
  const [note, setNote] = useState<string | null>(null);
  const [noteMinDelayElapsed, setNoteMinDelayElapsed] = useState(false);

  useEffect(() => {
    if (!isFirstCheckin) return;
    const timeout = setTimeout(() => setShowFirstCheckinText(false), FIRST_CHECKIN_TEXT_MS);
    return () => clearTimeout(timeout);
  }, [isFirstCheckin]);

  useEffect(() => {
    const timeout = setTimeout(() => setNoteMinDelayElapsed(true), NOTE_MIN_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!emotion) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NOTE_FETCH_TIMEOUT_MS);
    fetch("/api/state-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, emotion, locale }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.note) setNote(data.note);
      })
      .catch(() => {
        // Silently skip the note on failure or timeout — never blocks the reveal.
      })
      .finally(() => clearTimeout(timeoutId));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
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

  const showNote = emotion && note && noteMinDelayElapsed;

  return (
    <div className={styles.card}>
      <h1 className={`${styles.fadeItem} ${styles.stateName}`} style={{ color }}>
        {t(`states.${state}.header`)}
      </h1>
      <p className={`${styles.fadeItem} ${styles.description}`}>{t(`states.${state}.description`)}</p>
      {showNote && (
        <p className={`${styles.fadeItem} ${styles.note}`} style={{ borderLeftColor: color }}>
          {note}
        </p>
      )}
      {showQuestion && (
        <p className={`${styles.fadeItem} ${styles.question}`}>{t(`states.${state}.question`)}</p>
      )}
      <button
        type="button"
        className={`${styles.fadeItem} ${styles.continueBtn}`}
        style={showQuestion ? undefined : { animationDelay: "600ms" }}
        onClick={onContinue}
      >
        {t("continue")}
      </button>
    </div>
  );
}
