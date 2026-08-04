"use client";

import { useLocale } from "next-intl";
import { doc, setDoc } from "firebase/firestore";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db } from "@/lib/firebase";
import type { Locale } from "@/i18n/routing";
import styles from "./language-toggle.module.css";

type LanguageToggleProps = {
  // "light" for pages on the app's light background (history, report), "dark"
  // for pages on the dark background (onboarding/landing).
  variant?: "light" | "dark";
};

export function LanguageToggle({ variant = "light" }: LanguageToggleProps) {
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

  const activeClass = variant === "dark" ? styles.activeDark : styles.active;
  const inactiveClass = variant === "dark" ? styles.inactiveDark : styles.inactive;
  const sepClass = variant === "dark" ? styles.sepDark : styles.sep;

  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={locale === "en" ? activeClass : inactiveClass}
        onClick={() => switchTo("en")}
      >
        EN
      </button>
      <span className={sepClass}>·</span>
      <button
        type="button"
        className={locale === "ru" ? activeClass : inactiveClass}
        onClick={() => switchTo("ru")}
      >
        RU
      </button>
    </div>
  );
}
