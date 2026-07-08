"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthGuard } from "@/components/AuthGuard";

function ReportPendingInner() {
  const t = useTranslations("ReportPending");

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#080914] px-8 pt-[calc(env(safe-area-inset-top)+56px)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-[32px] font-light leading-tight tracking-[-0.02em] text-[#e8e4ff]">
          {t("headline")}
        </h1>
        <p className="max-w-[300px] text-[17px] leading-[1.7] text-[#6868b0]">{t("body")}</p>
      </div>
      <div className="w-full px-2 pb-[calc(env(safe-area-inset-bottom)+36px)]">
        <Link
          href="/history"
          className="block w-full rounded-2xl border border-[#6b5fd0] bg-[#4a3fa0] py-[18px] text-center text-[17px] text-[#e0d8ff]"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}

export default function ReportPendingPage() {
  return (
    <AuthGuard>
      <ReportPendingInner />
    </AuthGuard>
  );
}
