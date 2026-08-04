"use client";

import { useLocale } from "next-intl";
import { doc, setDoc } from "firebase/firestore";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import type { Locale } from "@/i18n/routing";
import styles from "./language-toggle.module.css";

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAnonymousAuth();

  async function switchTo(nextLocale: Locale) {
    if (nextLocale === locale) return;

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { locale: nextLocale }, { merge: true });
      } catch (err) {
        console.error("Failed to update locale preference", err);
      }
    }

    router.push(pathname, { locale: nextLocale });
  }

  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={locale === "en" ? styles.active : styles.inactive}
        onClick={() => switchTo("en")}
      >
        EN
      </button>
      <span className={styles.sep}>·</span>
      <button
        type="button"
        className={locale === "ru" ? styles.active : styles.inactive}
        onClick={() => switchTo("ru")}
      >
        RU
      </button>
    </div>
  );
}
