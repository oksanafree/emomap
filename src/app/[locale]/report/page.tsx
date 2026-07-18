"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import mapStyles from "@/styles/map-visual.module.css";
import styles from "./report.module.css";

const TICK_MS = 1400;
const POLL_MS = 5000;
const MESSAGE_ROTATE_MS = 3000;
const MIN_ENTRIES_FOR_REPORT = 5;
const FULL_REPORT_ENTRIES = 20;
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GENERATING_MESSAGE_COUNT = 4;

type Step = { left: number; top: number };
type CacheStatus = "loading" | "found" | "empty" | "generating" | "error";

function lineOpacityAtDraw(i: number) {
  return Math.min(0.1 + i * 0.045, 0.75);
}

export default function ReportPage() {
  const t = useTranslations("Report");
  const tMap = useTranslations("Map");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAnonymousAuth();
  const [timestamps, setTimestamps] = useState<Date[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [moverReady, setMoverReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>("loading");
  const [reportText, setReportText] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const part2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, "users", user.uid, "entries"), orderBy("timestamp", "asc"))).then(
      (snapshot) => {
        if (cancelled) return;
        const dates: Date[] = [];
        const pts: Step[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.timestamp instanceof Timestamp) dates.push(data.timestamp.toDate());
          pts.push({ left: 50 + data.x * 42, top: 50 - data.y * 42 });
        });
        setTimestamps(dates);
        setSteps(pts);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    // Wait for the entries fetch above to resolve so we know the real entry
    // count before deciding between "not enough entries" and "generating".
    if (!user || timestamps === null) return;
    let cancelled = false;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    async function checkReport() {
      try {
        const userRef = doc(db, "users", user!.uid);
        const snap = await getDoc(userRef);
        if (cancelled) return;

        const data = snap.data();
        const localeReport = data?.[`report_${locale}`];
        if (typeof localeReport?.text === "string" && localeReport.text) {
          setReportText(localeReport.text);
          setLastGeneratedAt(localeReport.last_generated_at?.toDate?.() ?? null);
          setCacheStatus("found");
          return;
        }

        // Legacy single-language report field from before per-locale caching —
        // migrate it onto the current locale's path so the user isn't blocked
        // behind a fresh (~2min) generation for a report that already exists.
        const legacyReport = data?.report;
        if (legacyReport && typeof legacyReport.text === "string" && legacyReport.text) {
          try {
            await updateDoc(userRef, {
              [`report_${locale}`]: legacyReport,
              report: deleteField(),
            });
          } catch (error) {
            console.error("Failed to migrate legacy report field", error);
          }
          if (cancelled) return;
          setReportText(legacyReport.text);
          setLastGeneratedAt(legacyReport.last_generated_at?.toDate?.() ?? null);
          setCacheStatus("found");
          return;
        }

        if (timestamps!.length < MIN_ENTRIES_FOR_REPORT) {
          setCacheStatus("empty");
          return;
        }

        // Generation may already be in flight from the check-in milestone
        // trigger (src/app/[locale]/context/page.tsx). Just viewing this page
        // never kicks off a new generation — only an explicit tap on "reveal"
        // or "Refresh report" does that. Poll in case one is already running.
        setCacheStatus("generating");
        pollTimeout = setTimeout(checkReport, POLL_MS);
      } catch {
        if (!cancelled) setCacheStatus("error");
      }
    }

    checkReport();
    return () => {
      cancelled = true;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [user, locale, timestamps]);

  function handleRefresh() {
    if (!user) return;
    if (lastGeneratedAt && Date.now() - lastGeneratedAt.getTime() < REFRESH_COOLDOWN_MS) return;

    // Fire the regeneration in the background and move on immediately — the
    // report-pending screen (and its notification when ready) takes over from
    // here instead of making the user wait on this page.
    const type = (timestamps?.length ?? 0) >= FULL_REPORT_ENTRIES ? "full" : "short";
    fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, locale, type }),
    }).catch(() => {});
    router.push("/report-pending");
  }

  useEffect(() => {
    if (cacheStatus !== "generating") return;
    setMessageIndex(0);
    const interval = setInterval(
      () => setMessageIndex((i) => (i + 1) % GENERATING_MESSAGE_COUNT),
      MESSAGE_ROTATE_MS,
    );
    return () => clearInterval(interval);
  }, [cacheStatus]);

  useEffect(() => {
    if (steps.length === 0) return;
    setVisibleCount(1);
    setMoverReady(false);
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMoverReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [steps]);

  useEffect(() => {
    if (visibleCount === 0 || visibleCount >= steps.length) return;
    const timeout = setTimeout(() => setVisibleCount((v) => v + 1), TICK_MS);
    return () => clearTimeout(timeout);
  }, [visibleCount, steps.length]);

  const dots = useMemo(() => {
    if (visibleCount === 0) return [];
    const upTo = visibleCount === steps.length ? visibleCount : visibleCount - 1;
    return steps.slice(0, upTo);
  }, [steps, visibleCount]);

  const lines = useMemo(() => {
    if (visibleCount < 2) return [];
    const currentStep = visibleCount - 1;
    const result = [];
    for (let i = 1; i < visibleCount; i++) {
      const base = lineOpacityAtDraw(i);
      const fadeCount = currentStep - i;
      const opacity = Math.max(base - 0.012 * fadeCount, 0.02);
      result.push({ from: steps[i - 1], to: steps[i], opacity });
    }
    return result;
  }, [steps, visibleCount]);

  const mover = visibleCount > 0 ? steps[visibleCount - 1] : null;
  const isCoolingDown = Boolean(lastGeneratedAt && Date.now() - lastGeneratedAt.getTime() < REFRESH_COOLDOWN_MS);

  const dateFormatter = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });
  const mapSubtitle =
    timestamps && timestamps.length > 0
      ? (() => {
          const first = timestamps[0];
          const last = timestamps[timestamps.length - 1];
          const dateRange =
            first.toDateString() === last.toDateString()
              ? dateFormatter.format(first)
              : `${dateFormatter.format(first)} – ${dateFormatter.format(last)}`;
          return t("mapSubtitle", { dateRange, count: timestamps.length });
        })()
      : "";

  function handleReveal() {
    if (cacheStatus === "generating") {
      // Report isn't cached yet — kick off generation in the background and
      // send the user to the report-pending screen instead of making them
      // wait here. They get a notification when it's ready.
      if (user) {
        const type = (timestamps?.length ?? 0) >= FULL_REPORT_ENTRIES ? "full" : "short";
        fetch("/api/report/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid, locale, type }),
        }).catch(() => {});
      }
      router.push("/report-pending");
      return;
    }
    setRevealed(true);
    part2Ref.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <AuthGuard>
      <div>
        <div className={styles.darkSection}>
          <div className={styles.nav}>
            <Link href="/history" className={styles.navBack}>
              ‹
            </Link>
            <div className={styles.navTitle}>{t("navTitle")}</div>
            <div className={styles.navSp} />
          </div>

          <div className={mapStyles.mapWrap}>
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
            <svg className={mapStyles.mapSvg}>
              {dots.map((d, i) => (
                <circle key={i} cx={`${d.left}%`} cy={`${d.top}%`} r="3%" fill="rgba(255,255,255,0.25)" />
              ))}
              {lines.map((l, i) => (
                <line
                  key={i}
                  x1={`${l.from.left}%`}
                  y1={`${l.from.top}%`}
                  x2={`${l.to.left}%`}
                  y2={`${l.to.top}%`}
                  stroke={`rgba(255,255,255,${l.opacity})`}
                  strokeWidth="1.2"
                  strokeDasharray="3,5"
                />
              ))}
            </svg>
            {mover && (
              <div
                className={mapStyles.mdot}
                style={{
                  left: `${mover.left}%`,
                  top: `${mover.top}%`,
                  transition: moverReady ? undefined : "none",
                }}
              />
            )}
          </div>

          {timestamps === null ? (
            <p className={styles.status}>{t("loading")}</p>
          ) : timestamps.length === 0 ? (
            <p className={styles.status}>{t("empty")}</p>
          ) : (
            <>
              <div className={styles.headline}>{t("mapTitle")}</div>
              <div className={styles.subtext}>{mapSubtitle}</div>
              <button type="button" className={styles.revealBtn} onClick={handleReveal}>
                {t("reveal")}
              </button>
            </>
          )}
        </div>

        <div
          ref={part2Ref}
          className={`${styles.lightSection} ${cacheStatus === "generating" ? styles.lightSectionGenerating : ""}`}
          style={{ opacity: revealed ? 1 : 0 }}
        >
          {cacheStatus === "loading" && <p className={styles.placeholder}>{t("loading")}</p>}
          {cacheStatus === "generating" && (
            <p key={messageIndex} className={styles.generatingMessage}>
              {t(`generatingMessages.${messageIndex}`)}
            </p>
          )}
          {cacheStatus === "empty" && (
            <>
              <p className={styles.placeholder}>{t("notEnoughEntries")}</p>
              <Link href="/history" className={styles.revealBtn}>
                {t("back")}
              </Link>
            </>
          )}
          {cacheStatus === "error" && (
            <>
              <p className={styles.placeholder}>{t("reportError")}</p>
              <Link href="/history" className={styles.revealBtn}>
                {t("back")}
              </Link>
            </>
          )}
          {cacheStatus === "found" && reportText && (
            <>
              {(timestamps?.length ?? 0) >= MIN_ENTRIES_FOR_REPORT && (
                <button
                  type="button"
                  className={`${styles.refreshBtn} ${isCoolingDown ? styles.refreshBtnDisabled : ""}`}
                  onClick={handleRefresh}
                  disabled={isCoolingDown}
                >
                  {isCoolingDown ? t("refreshedRecently") : t("refresh")}
                </button>
              )}
              <p className={styles.reportText}>{reportText}</p>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
