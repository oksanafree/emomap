"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { Link } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import mapStyles from "@/styles/map-visual.module.css";
import styles from "./report.module.css";

const TICK_MS = 1400;

type Step = { left: number; top: number };
type CacheStatus = "loading" | "found" | "empty";

function lineOpacityAtDraw(i: number) {
  return Math.min(0.1 + i * 0.045, 0.75);
}

export default function ReportPage() {
  const t = useTranslations("Report");
  const tMap = useTranslations("Map");
  const locale = useLocale();
  const { user } = useAnonymousAuth();
  const [timestamps, setTimestamps] = useState<Date[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [moverReady, setMoverReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>("loading");
  const [reportText, setReportText] = useState<string | null>(null);
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
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const text = snap.data()?.report?.text;
        if (typeof text === "string" && text) {
          setReportText(text);
          setCacheStatus("found");
        } else {
          setCacheStatus("empty");
        }
      })
      .catch(() => {
        if (!cancelled) setCacheStatus("empty");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const dateFormatter = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });
  const bodyText =
    timestamps && timestamps.length > 0
      ? (() => {
          const first = timestamps[0];
          const last = timestamps[timestamps.length - 1];
          return first.toDateString() === last.toDateString()
            ? t("bodySameDay", { date: dateFormatter.format(first) })
            : t("body", {
                firstDate: dateFormatter.format(first),
                lastDate: dateFormatter.format(last),
              });
        })()
      : "";

  function handleReveal() {
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
              <div className={styles.headline}>{t("headline")}</div>
              <div className={styles.subtext}>{bodyText}</div>
              <div className={styles.checkinsCount}>{t("checkinsCount", { count: timestamps.length })}</div>
              <button type="button" className={styles.revealBtn} onClick={handleReveal}>
                {t("reveal")}
              </button>
            </>
          )}
        </div>

        <div ref={part2Ref} className={styles.lightSection} style={{ opacity: revealed ? 1 : 0 }}>
          {cacheStatus === "loading" && <p className={styles.placeholder}>{t("loading")}</p>}
          {cacheStatus === "empty" && (
            <>
              <p className={styles.placeholder}>{t("notEnoughEntries")}</p>
              <Link href="/history" className={styles.revealBtn}>
                {t("back")}
              </Link>
            </>
          )}
          {cacheStatus === "found" && reportText && <p className={styles.reportText}>{reportText}</p>}
        </div>
      </div>
    </AuthGuard>
  );
}
