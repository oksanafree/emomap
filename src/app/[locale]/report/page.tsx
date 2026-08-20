"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, doc, getCountFromServer, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { Link } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import { LanguageToggle } from "@/components/LanguageToggle";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "./report.module.css";

const MIN_ENTRIES_FOR_REFRESH = 5;
const FULL_REPORT_ENTRIES = 20;
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// TEMP (testing): the 24h manual-refresh cap is disabled so the Russian report
// can be regenerated freely during testing. RESTORE to `true` when done (must
// match MANUAL_REFRESH_RATE_LIMIT_ENABLED in api/report/generate/route.ts).
const MANUAL_REFRESH_RATE_LIMIT_ENABLED = false;

type LoadStatus = "loading" | "ready" | "empty" | "error";

function ReportPageInner() {
  const t = useTranslations("Report");
  const locale = useLocale();
  const { user } = useAnonymousAuth();
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reportText, setReportText] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const loadReport = useCallback(async () => {
    if (!user) return;
    try {
      const [userSnap, countSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getCountFromServer(collection(db, "users", user.uid, "entries")),
      ]);
      const data = userSnap.data();
      const count = countSnap.data().count;
      setEntryCount(count);

      const lastRefreshed = data?.report_last_refreshed_at;
      setLastRefreshedAt(lastRefreshed instanceof Timestamp ? lastRefreshed.toDate() : null);

      const text = data?.[`report_${locale}`]?.text;
      if (typeof text === "string" && text.length > 0) {
        // report_generated_at was added after this feature shipped, so older
        // reports may not have it — fall back to the per-locale timestamp
        // that's existed since report generation itself was built, then to
        // whatever timestamp the user document happens to carry.
        const generated =
          data?.report_generated_at ??
          data?.[`report_${locale}`]?.last_generated_at ??
          data?.updatedAt ??
          data?.createdAt ??
          null;
        setGeneratedAt(generated instanceof Timestamp ? generated.toDate() : null);
        setReportText(text);
        setStatus("ready");

        // Baseline for the "report updated" map popup: record how many
        // check-ins the user had when they last actually viewed a report, so
        // that popup can fire again once they've added 10 more since now.
        setDoc(
          doc(db, "users", user.uid),
          { report_last_viewed_entry_count: count },
          { merge: true },
        ).catch((error) => console.error("Failed to record report view count", error));
      } else {
        setReportText(null);
        setStatus(count < MIN_ENTRIES_FOR_REFRESH ? "empty" : "ready");
      }
    } catch (error) {
      console.error("Failed to load report", error);
      setStatus("error");
    }
  }, [user, locale]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  async function handleRefresh() {
    if (!user || refreshing || refreshedWithin24h) return;
    setRefreshing(true);
    try {
      const type = (entryCount ?? 0) >= FULL_REPORT_ENTRIES ? "full" : "short";
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // source: "manual" — the server rate-limits this to once per 24h and
        // writes report_last_refreshed_at itself (the authoritative gate).
        body: JSON.stringify({ userId: user.uid, locale, type, source: "manual" }),
      });
      // Server enforced the 24h cap (e.g. already refreshed on another
      // device): reflect it in the UI instead of showing an error.
      if (res.status === 429) {
        setLastRefreshedAt(new Date());
        await loadReport();
        return;
      }
      if (!res.ok) throw new Error("Report generation failed");
      setLastRefreshedAt(new Date());
      await loadReport();
    } catch (error) {
      console.error("Failed to refresh report", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" });
  const canRefresh = entryCount !== null && entryCount >= MIN_ENTRIES_FOR_REFRESH;
  const refreshedWithin24h =
    MANUAL_REFRESH_RATE_LIMIT_ENABLED &&
    lastRefreshedAt !== null &&
    Date.now() - lastRefreshedAt.getTime() < REFRESH_COOLDOWN_MS;

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/history" className={checkinStyles.navBack}>
            ‹
          </Link>
          <LanguageToggle />
          <div className={checkinStyles.navTitle}>{t("navTitle")}</div>
          <div className={checkinStyles.navSp} />
        </div>

        <div className={styles.scroll}>
          <h1 className={styles.title}>{t("title")}</h1>

          {status === "loading" && <p className={styles.status}>{t("loading")}</p>}
          {status === "error" && <p className={styles.status}>{t("reportError")}</p>}
          {status === "empty" && <p className={styles.status}>{t("notEnoughEntries")}</p>}

          {status === "ready" && (
            <>
              {generatedAt && (
                <p className={styles.generatedAt}>
                  {t("generatedOn", { date: dateFormatter.format(generatedAt) })}
                </p>
              )}
              {canRefresh && (
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={handleRefresh}
                  disabled={refreshing || refreshedWithin24h}
                >
                  {refreshedWithin24h ? t("refreshedToday") : refreshing ? t("updating") : t("refresh")}
                </button>
              )}
              {reportText && <p className={styles.reportText}>{reportText}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <AuthGuard>
      <ReportPageInner />
    </AuthGuard>
  );
}
