"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import checkinStyles from "@/styles/checkin-screen.module.css";

function ReportPendingInner() {
  const t = useTranslations("ReportPending");
  const searchParams = useSearchParams();
  const milestone = searchParams.get("milestone") === "twoWeek" ? "twoWeek" : "five";

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg leading-relaxed text-[#6a6870]">{t(`${milestone}.message`)}</p>
        </div>
        <div className={checkinStyles.pb}>
          <Link href="/history" className={checkinStyles.btnMain}>
            {t("cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ReportPendingPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <ReportPendingInner />
      </Suspense>
    </AuthGuard>
  );
}
