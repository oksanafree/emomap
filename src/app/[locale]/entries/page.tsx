"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { Link } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import type { StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import { AuthGuard } from "@/components/AuthGuard";
import styles from "./entries.module.css";

const SWIPE_REVEAL_THRESHOLD = 40;
const LONG_PRESS_MS = 500;

type Entry = {
  id: string;
  timestamp: Date | null;
  state: StateKey | null;
};

function EntryRow({
  entry,
  dateLabel,
  stateLabel,
  deleteLabel,
  onDelete,
}: {
  entry: Entry;
  dateLabel: string;
  stateLabel: string | null;
  deleteLabel: string;
  onDelete: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const color = getStateColor(entry.state);

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchStart(e: ReactTouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => setRevealed(true), LONG_PRESS_MS);
  }

  function handleTouchMove(e: ReactTouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (deltaX < -SWIPE_REVEAL_THRESHOLD) {
      clearLongPressTimer();
      setRevealed(true);
    }
  }

  function handleTouchEnd() {
    touchStartX.current = null;
    clearLongPressTimer();
  }

  return (
    <div className={styles.entryRow}>
      <button type="button" className={styles.entryDeleteBtn} onClick={() => onDelete(entry.id)}>
        {deleteLabel}
      </button>
      <div
        className={`${styles.entryContent} ${revealed ? styles.entryContentRevealed : ""}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => revealed && setRevealed(false)}
      >
        <span className={styles.entryDate}>{dateLabel}</span>
        {stateLabel && (
          <span className={styles.entryState} style={{ color }}>
            {stateLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function EntriesPageInner() {
  const t = useTranslations("Entries");
  const tMap = useTranslations("Map");
  const locale = useLocale();
  const { user, loading: authLoading } = useAnonymousAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, "users", user.uid, "entries"), orderBy("timestamp", "desc")))
      .then((snapshot) => {
        if (cancelled) return;
        setEntries(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
              state: (data.state as StateKey) ?? null,
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleDeleteEntry(entryId: string) {
    if (!user) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "entries", entryId));
      setEntries((prev) => (prev ? prev.filter((e) => e.id !== entryId) : prev));
    } catch (err) {
      console.error("Failed to delete entry", err);
    }
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={styles.screen}>
      <div className={styles.maxW}>
        <div className={styles.nav}>
          <Link href="/history" className={styles.navBack}>
            ‹
          </Link>
          <div className={styles.navTitle}>{t("navTitle")}</div>
          <div className={styles.navSp} />
        </div>

        <div className={styles.scroll}>
          {authLoading || entries === null ? (
            <p className={styles.status}>{t("loading")}</p>
          ) : error ? (
            <p className={styles.status}>{t("error")}</p>
          ) : entries.length === 0 ? (
            <p className={styles.status}>{t("empty")}</p>
          ) : (
            entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                dateLabel={entry.timestamp ? dateFormatter.format(entry.timestamp) : ""}
                stateLabel={entry.state ? tMap(`states.${entry.state}.name`) : null}
                deleteLabel={t("delete")}
                onDelete={handleDeleteEntry}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function EntriesPage() {
  return (
    <AuthGuard>
      <EntriesPageInner />
    </AuthGuard>
  );
}
