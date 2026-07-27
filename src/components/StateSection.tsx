"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Intensity, StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./state-section.module.css";

const NOTE_MIN_DELAY_MS = 600;
const NOTE_FETCH_TIMEOUT_MS = 4000;

type StateSectionProps = {
  state: StateKey;
  emotion: string;
  intensity: Intensity;
  isFirstCheckin: boolean;
  showQuestion: boolean;
  locale: string;
};

export function StateSection({
  state,
  emotion,
  intensity,
  isFirstCheckin,
  showQuestion,
  locale,
}: StateSectionProps) {
  const t = useTranslations("StateCard");
  const color = getStateColor(state);
  const [note, setNote] = useState<string | null>(null);
  const [noteMinDelayElapsed, setNoteMinDelayElapsed] = useState(false);

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
      body: JSON.stringify({ state, emotion, intensity, locale }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.note) setNote(data.note);
      })
      .catch(() => {
        // Silently skip the note on failure or timeout.
      })
      .finally(() => clearTimeout(timeoutId));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, emotion, intensity, locale]);

  const showNote = Boolean(emotion) && Boolean(note) && noteMinDelayElapsed;

  return (
    <div className={styles.section}>
      {isFirstCheckin && <p className={styles.firstCheckinCaption}>{t("firstCheckinText")}</p>}
      <h2 className={styles.stateName} style={{ color }}>
        {t(`states.${state}.header`)}
      </h2>
      <p className={styles.description}>{t(`states.${state}.description`)}</p>
      {showNote && (
        <p className={styles.note} style={{ borderLeftColor: color }}>
          {note}
        </p>
      )}
      {showQuestion && <p className={styles.question}>{t(`states.${state}.question`)}</p>}
    </div>
  );
}
