"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import styles from "./checkin-done.module.css";

const DISMISS_MS = 4000;

function CheckinDoneInner() {
  const t = useTranslations("CheckinDone");
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = Number(searchParams.get("count")) || 0;
  const tier = count < 5 ? "under5" : count < 20 ? "midRange" : "full";

  useEffect(() => {
    const timer = setTimeout(() => router.push("/history"), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [router]);

  function dismiss() {
    router.push("/history");
  }

  return (
    <div className={styles.screen} onClick={dismiss}>
      <div className={styles.content}>
        <h1 className={styles.headline}>{t(`${tier}.headline`)}</h1>
        <p className={styles.subtext}>{t(`${tier}.subtext`)}</p>
      </div>

      <div className={styles.ctaWrap}>
        <button
          type="button"
          className={styles.cta}
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
        >
          {t("cta")}
        </button>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} />
      </div>
    </div>
  );
}

export default function CheckinDonePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <CheckinDoneInner />
      </Suspense>
    </AuthGuard>
  );
}
