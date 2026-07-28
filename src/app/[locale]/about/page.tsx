"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import checkinStyles from "@/styles/checkin-screen.module.css";
import legalStyles from "@/styles/legal.module.css";
import { AboutEn, AboutRu } from "./about-content";

export default function AboutPage() {
  const t = useTranslations("Legal");
  const locale = useLocale();

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/" className={checkinStyles.navBack}>
            ‹
          </Link>
          <div className={checkinStyles.navTitle}>{t("aboutTitle")}</div>
          <div className={checkinStyles.navSp} />
        </div>

        <div className={legalStyles.scroll}>
          <h1 className={legalStyles.title}>{t("aboutTitle")}</h1>
          {locale === "ru" ? <AboutRu /> : <AboutEn />}
        </div>
      </div>
    </div>
  );
}
