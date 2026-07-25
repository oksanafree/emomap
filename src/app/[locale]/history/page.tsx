"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { useSliderSound } from "@/lib/use-slider-sound";
import { db } from "@/lib/firebase";
import { isIOS, isStandalonePwa } from "@/lib/platform";
import type { StateKey } from "@/lib/state-detection";
import { AuthGuard } from "@/components/AuthGuard";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import mapStyles from "@/styles/map-visual.module.css";
import styles from "./history.module.css";

const NOTIF_ASKED_KEY = "notif_asked";
const INSTALL_PROMPT_SEEN_KEY = "install_prompt_seen";
const FULL_REPORT_ENTRIES = 20;
const SWIPE_REVEAL_THRESHOLD = 40;
const LONG_PRESS_MS = 500;

type HistoryEntry = {
  id: string;
  timestamp: Date | null;
  world_value: number;
  self_value: number;
  x: number;
  y: number;
  state: StateKey | null;
};

function EntryRow({
  entry,
  dateLabel,
  stateLabel,
  deleteLabel,
  onDelete,
}: {
  entry: HistoryEntry;
  dateLabel: string;
  stateLabel: string | null;
  deleteLabel: string;
  onDelete: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        {stateLabel && <span className={styles.entryState}>{stateLabel}</span>}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const t = useTranslations("History");
  const tMap = useTranslations("Map");
  const tInstall = useTranslations("Install");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAnonymousAuth();
  const { sndNav } = useSliderSound();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!entries || entries.length === 0) return;
    if (!localStorage.getItem(NOTIF_ASKED_KEY)) {
      setShowNotifPrompt(true);
    }
  }, [entries]);

  useEffect(() => {
    if (isIOS() && !isStandalonePwa() && !localStorage.getItem(INSTALL_PROMPT_SEEN_KEY)) {
      setShowIOSBanner(true);
    }
  }, []);

  function dismissIOSBanner() {
    localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, "true");
    setShowIOSBanner(false);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, "users", user.uid, "entries"), orderBy("timestamp", "desc")))
      .then((snapshot) => {
        if (cancelled) return;
        setEntries(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null;
            return {
              id: docSnap.id,
              timestamp,
              world_value: data.world_value,
              self_value: data.self_value,
              x: data.x,
              y: data.y,
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

  function handleNewMoment() {
    sndNav();
    router.push("/world");
  }

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

  const dayCount = entries
    ? new Set(entries.filter((e) => e.timestamp).map((e) => e.timestamp!.toDateString())).size
    : 0;

  // entries is fetched newest-first; the trail line on the map should connect
  // moments in the order they happened, so reverse it to oldest-first here.
  const chronological = entries ? [...entries].reverse() : [];
  const mostRecentId = entries && entries.length > 0 ? entries[0].id : null;

  const statsLine =
    entries && entries.length > 0
      ? [
          t("entriesCount", { count: entries.length }),
          t("daysCount", { count: dayCount }),
          ...(entries.length < FULL_REPORT_ENTRIES
            ? [t("fullReportRemaining", { remaining: FULL_REPORT_ENTRIES - entries.length })]
            : []),
        ].join(" · ")
      : " ";

  return (
    <AuthGuard>
      {showNotifPrompt && <NotificationPrompt onClose={() => setShowNotifPrompt(false)} />}
      <div className="flex min-h-screen flex-col bg-[#f7f6f4]">
        <div className={styles.topBar}>
          <div className={styles.statsLine}>{statsLine}</div>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.mapArea}>
            {showIOSBanner && (
              <div className={styles.iosBanner}>
                <p className={styles.iosBannerText}>{tInstall("iosText")}</p>
                <button type="button" className={styles.iosBannerDismiss} onClick={dismissIOSBanner}>
                  {tInstall("dismiss")}
                </button>
              </div>
            )}
            <div className={mapStyles.mapWrap} style={{ maxWidth: "min(90vw, 440px)" }}>
              <div className={mapStyles.axH} />
              <div className={mapStyles.axV} />
              <div className={mapStyles.ring} style={{ width: "23%", height: "23%" }} />
              <div className={mapStyles.ring} style={{ width: "46%", height: "46%" }} />
              <div className={mapStyles.ring} style={{ width: "70%", height: "70%" }} />
              <div className={mapStyles.ql} style={{ top: 8, left: 10 }}>
                {tMap("quadrants.protecting")}
              </div>
              <div className={mapStyles.ql} style={{ top: 8, right: 10 }}>
                {tMap("quadrants.building")}
              </div>
              <div className={mapStyles.ql} style={{ bottom: 8, left: 10 }}>
                {tMap("quadrants.enduring")}
              </div>
              <div className={mapStyles.ql} style={{ bottom: 8, right: 10 }}>
                {tMap("quadrants.receiving")}
              </div>
              {chronological.length > 1 && (
                <svg className={mapStyles.mapSvg}>
                  {chronological.slice(1).map((entry, i) => {
                    const from = chronological[i];
                    return (
                      <line
                        key={entry.id}
                        x1={`${50 + from.x * 42}%`}
                        y1={`${50 - from.y * 42}%`}
                        x2={`${50 + entry.x * 42}%`}
                        y2={`${50 - entry.y * 42}%`}
                        stroke="rgba(124, 108, 240, 0.3)"
                        strokeWidth="1"
                      />
                    );
                  })}
                </svg>
              )}
              {entries?.map((entry) => (
                <div
                  key={entry.id}
                  className={`${mapStyles.constellationDot} ${
                    entry.id === mostRecentId ? styles.dotRecent : styles.dotFaded
                  }`}
                  style={{
                    left: `${50 + entry.x * 42}%`,
                    top: `${50 - entry.y * 42}%`,
                  }}
                />
              ))}
            </div>

            {authLoading || entries === null ? (
              <p className={styles.secLbl}>{t("loading")}</p>
            ) : error ? (
              <p className={styles.secLbl}>{t("error")}</p>
            ) : entries.length === 0 ? (
              <p className={styles.secLbl}>{t("empty")}</p>
            ) : (
              <div className={styles.mapLabel}>{t("mapLabel")}</div>
            )}
          </div>

          {entries && entries.length > 0 && (
            <div className={styles.entryList}>
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  dateLabel={entry.timestamp ? dateFormatter.format(entry.timestamp) : ""}
                  stateLabel={entry.state ? tMap(`states.${entry.state}.name`) : null}
                  deleteLabel={t("delete")}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.bottomBar}>
          <Link href="/report" className={styles.ghostBtn}>
            {t("seeReport")}
          </Link>
          <button type="button" className={styles.solidBtn} onClick={handleNewMoment}>
            {t("newMoment")}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
