"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import checkinStyles from "@/styles/checkin-screen.module.css";
import legalStyles from "@/styles/legal.module.css";
import { TermsOfServiceEn, TermsOfServiceRu } from "./terms-content";

export default function TermsPage() {
  const t = useTranslations("Legal");
  const locale = useLocale();

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/" className={checkinStyles.navBack}>
            ‹
          </Link>
          <div className={checkinStyles.navTitle}>{t("termsTitle")}</div>
          <div className={checkinStyles.navSp} />
        </div>

        <div className={legalStyles.scroll}>
          <h1 className={legalStyles.title}>{t("termsTitle")}</h1>
          {locale === "ru" ? <TermsOfServiceRu /> : <TermsOfServiceEn />}
        </div>
      </div>
    </div>
  );
}
