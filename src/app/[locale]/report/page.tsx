"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, doc, getCountFromServer, getDoc, Timestamp } from "firebase/firestore";
import { Link } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "./report.module.css";

const MIN_ENTRIES_FOR_REFRESH = 5;
const FULL_REPORT_ENTRIES = 20;

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

      const text = data?.[`report_${locale}`]?.text;
      if (typeof text === "string" && text.length > 0) {
        const generated = data?.report_generated_at;
        setGeneratedAt(generated instanceof Timestamp ? generated.toDate() : null);
        setReportText(text);
        setStatus("ready");
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
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      const type = (entryCount ?? 0) >= FULL_REPORT_ENTRIES ? "full" : "short";
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, locale, type }),
      });
      if (!res.ok) throw new Error("Report generation failed");
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

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/history" className={checkinStyles.navBack}>
            ‹
          </Link>
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
              {reportText && <p className={styles.reportText}>{reportText}</p>}
            </>
          )}

          {canRefresh && (
            <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? t("updating") : t("refresh")}
            </button>
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
