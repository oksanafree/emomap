"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeUserToPush } from "@/lib/notifications";
import { isIOS, isStandalonePwa } from "@/lib/platform";
import styles from "./notification-prompt.module.css";

const NOTIF_ASKED_KEY = "notif_asked";

type NotificationPromptProps = {
  onClose: () => void;
};

type ErrorKind = "generic" | "iosBrowser";

export function NotificationPrompt({ onClose }: NotificationPromptProps) {
  const t = useTranslations("Notifications");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);

  async function handleTurnOn() {
    setSubmitting(true);
    setError(null);
    const ok = await subscribeUserToPush();
    setSubmitting(false);
    localStorage.setItem(NOTIF_ASKED_KEY, "true");
    if (ok) {
      onClose();
    } else {
      // Web push requires the app to be installed to the home screen on iOS
      // Safari — getToken() will always fail in a plain browser tab there,
      // so point the user at the install step instead of a generic error.
      setError(isIOS() && !isStandalonePwa() ? "iosBrowser" : "generic");
    }
  }

  function handleSkip() {
    localStorage.setItem(NOTIF_ASKED_KEY, "true");
    onClose();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.badge}>
          <div className={styles.badgeDot} />
        </div>
        <div className={styles.headline}>{t.rich("headline", { br: () => <br /> })}</div>
        <div className={styles.body}>{t.rich("body", { br: () => <br /> })}</div>
      </div>
      <div className={styles.actions}>
        {error && <p className={styles.error}>{t(error === "iosBrowser" ? "setupErrorIOS" : "setupError")}</p>}
        <button type="button" className={styles.turnOn} onClick={handleTurnOn} disabled={submitting}>
          {t("turnOn")}
        </button>
        <button type="button" className={styles.skip} onClick={handleSkip}>
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
