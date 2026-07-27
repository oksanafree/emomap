"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import { isIOS, isStandalonePwa } from "@/lib/platform";
import type { Intensity, StateKey } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import { AuthGuard } from "@/components/AuthGuard";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { HeatMapCanvas } from "@/components/HeatMapCanvas";
import { StateSection } from "@/components/StateSection";
import { CheckinCountdown } from "@/components/CheckinCountdown";
import { ReturnNudge } from "@/components/ReturnNudge";
import mapStyles from "@/styles/map-visual.module.css";
import styles from "./history.module.css";

const MIN_ENTRIES_FOR_HEATMAP = 10;
const BRAND_PURPLE = "#7c6cf0";

const NOTIF_ASKED_KEY = "notif_asked";
const INSTALL_PROMPT_SEEN_KEY = "install_prompt_seen";
const NO_REPORT_MESSAGE_MS = 3000;

type HistoryEntry = {
  id: string;
  timestamp: Date | null;
  world_value: number;
  self_value: number;
  x: number;
  y: number;
  state: StateKey | null;
};

function HistoryPageInner() {
  const t = useTranslations("History");
  const tMap = useTranslations("Map");
  const tInstall = useTranslations("Install");
  const tLegal = useTranslations("Legal");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAnonymousAuth();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [showNoReportMessage, setShowNoReportMessage] = useState(false);

  // Captured once via lazy init so the section keeps rendering for the
  // lifetime of this page view even after the URL params below are stripped —
  // a later back-navigation or refresh to the plain /history URL must not
  // re-trigger it.
  const [newCheckinData] = useState(() => {
    if (searchParams.get("new") !== "1") return null;
    const state = searchParams.get("state") as StateKey | null;
    if (!state) return null;
    const intensityParam = searchParams.get("intensity");
    const intensity: Intensity = intensityParam === "low" || intensityParam === "high" ? intensityParam : "medium";
    return {
      state,
      emotion: searchParams.get("emotion") ?? "",
      intensity,
      isFirstCheckin: searchParams.get("firstCheckin") === "1",
      showQuestion: searchParams.get("showQuestion") === "1",
    };
  });

  useEffect(() => {
    if (!newCheckinData) return;
    // Strip only the one-time fresh-checkin params, preserving anything else
    // (e.g. firstDirection, which the map's own connecting-line logic reads
    // live from searchParams for the duration of this page view).
    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete("new");
    remaining.delete("state");
    remaining.delete("emotion");
    remaining.delete("intensity");
    remaining.delete("firstCheckin");
    remaining.delete("showQuestion");
    const query = remaining.toString();
    router.replace(query ? `/history?${query}` : "/history");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        const text = data?.[`report_${locale}`]?.text ?? data?.report?.text ?? null;
        setReportText(typeof text === "string" && text.length > 0 ? text : null);
      })
      .catch(() => {
        if (!cancelled) setReportText(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, locale]);

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

  function handleSeeReport() {
    if (reportText) {
      router.push("/report");
      return;
    }
    setShowNoReportMessage(true);
    window.setTimeout(() => setShowNoReportMessage(false), NO_REPORT_MESSAGE_MS);
  }

  function handleOpenEntries() {
    router.push("/entries");
  }

  const dayCount = entries
    ? new Set(entries.filter((e) => e.timestamp).map((e) => e.timestamp!.toDateString())).size
    : 0;

  // entries is fetched newest-first; the trail line on the map should connect
  // moments in the order they happened, so reverse it to oldest-first here.
  const chronological = entries ? [...entries].reverse() : [];
  const mostRecentId = entries && entries.length > 0 ? entries[0].id : null;

  const showFirstDirectionLine =
    entries !== null && entries.length === 2 && searchParams.get("firstDirection") === "1";

  const showHeatMap = entries !== null && entries.length >= MIN_ENTRIES_FOR_HEATMAP;

  const statsLine =
    entries && entries.length > 0
      ? [t("entriesCount", { count: entries.length }), t("daysCount", { count: dayCount })].join(" · ")
      : " ";

  const countdownColor = entries && entries.length > 0 ? getStateColor(entries[0].state) : BRAND_PURPLE;

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
              {showHeatMap && entries && (
                <HeatMapCanvas
                  points={entries.map((entry) => ({ x: entry.x, y: entry.y, color: getStateColor(entry.state) }))}
                />
              )}
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
                  {showFirstDirectionLine && (
                    <line
                      className={styles.firstDirectionLine}
                      x1={`${50 + chronological[0].x * 42}%`}
                      y1={`${50 - chronological[0].y * 42}%`}
                      x2={`${50 + chronological[1].x * 42}%`}
                      y2={`${50 - chronological[1].y * 42}%`}
                      pathLength={1}
                    />
                  )}
                </svg>
              )}
              {entries?.map((entry) => {
                const color = getStateColor(entry.state);
                const isMostRecent = entry.id === mostRecentId;
                return (
                  <div
                    key={entry.id}
                    className={`${mapStyles.constellationDot} ${isMostRecent ? styles.dotRecent : styles.dotFaded} ${
                      isMostRecent && newCheckinData ? styles.dotBloom : ""
                    }`}
                    style={{
                      left: `${50 + entry.x * 42}%`,
                      top: `${50 - entry.y * 42}%`,
                      background: color,
                      boxShadow: isMostRecent ? `0 0 10px 2px ${color}b3` : undefined,
                    }}
                  />
                );
              })}
            </div>
            {showFirstDirectionLine && <p className={styles.firstDirectionText}>{t("firstDirectionText")}</p>}

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

          {newCheckinData && (
            <StateSection
              state={newCheckinData.state}
              emotion={newCheckinData.emotion}
              intensity={newCheckinData.intensity}
              isFirstCheckin={newCheckinData.isFirstCheckin}
              showQuestion={newCheckinData.showQuestion}
              locale={locale}
            />
          )}

          {newCheckinData && <ReturnNudge state={newCheckinData.state} />}

          {entries !== null && (
            <CheckinCountdown
              entryCount={entries.length}
              color={countdownColor}
              onOpenReport={() => router.push("/report")}
            />
          )}

          <div className={styles.legalLinks}>
            <Link href="/settings">{t("settingsLink")}</Link>
            <span>·</span>
            <Link href="/privacy">{tLegal("privacyLink")}</Link>
            <span>·</span>
            <Link href="/terms">{tLegal("termsLink")}</Link>
          </div>
        </div>

        {showNoReportMessage && <p className={styles.noReportMessage}>{t("noReportYetMessage")}</p>}

        <div className={styles.bottomBar}>
          <button type="button" className={styles.primaryBtn} onClick={handleSeeReport}>
            {t("seeReportButton")}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={handleOpenEntries}>
            {t("entriesButton")}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageInner />
    </Suspense>
  );
}
