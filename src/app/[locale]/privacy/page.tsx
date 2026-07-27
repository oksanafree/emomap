"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import checkinStyles from "@/styles/checkin-screen.module.css";
import legalStyles from "@/styles/legal.module.css";
import { PrivacyPolicyEn, PrivacyPolicyRu } from "./privacy-content";

export default function PrivacyPage() {
  const t = useTranslations("Legal");
  const locale = useLocale();

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/" className={checkinStyles.navBack}>
            ‹
          </Link>
          <div className={checkinStyles.navTitle}>{t("privacyTitle")}</div>
          <div className={checkinStyles.navSp} />
        </div>

        <div className={legalStyles.scroll}>
          <h1 className={legalStyles.title}>{t("privacyTitle")}</h1>
          {locale === "ru" ? <PrivacyPolicyRu /> : <PrivacyPolicyEn />}
        </div>
      </div>
    </div>
  );
}
