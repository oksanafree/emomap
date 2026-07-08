"use client";

import { useTranslations } from "next-intl";
import { subscribeUserToPush } from "@/lib/notifications";
import styles from "./notification-prompt.module.css";

const NOTIF_ASKED_KEY = "notif_asked";

type NotificationPromptProps = {
  onClose: () => void;
};

export function NotificationPrompt({ onClose }: NotificationPromptProps) {
  const t = useTranslations("Notifications");

  function handleTurnOn() {
    subscribeUserToPush();
    localStorage.setItem(NOTIF_ASKED_KEY, "true");
    onClose();
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
        <div className={styles.body}>
          {t.rich("body", {
            br: () => <br />,
            em: (chunks) => <span className={styles.emphasis}>{chunks}</span>,
          })}
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.turnOn} onClick={handleTurnOn}>
          {t("turnOn")}
        </button>
        <button type="button" className={styles.skip} onClick={handleSkip}>
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
