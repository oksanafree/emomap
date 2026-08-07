"use client";

import styles from "./report-popup.module.css";

type ReportPopupProps = {
  headline: string;
  subtitle: string;
  primaryLabel: string;
  closeLabel: string;
  onPrimary: () => void;
  onClose: () => void;
};

export function ReportPopup({
  headline,
  subtitle,
  primaryLabel,
  closeLabel,
  onPrimary,
  onClose,
}: ReportPopupProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
        <div className={styles.badge}>
          <div className={styles.badgeDot} />
        </div>
        <h2 className={styles.headline}>{headline}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
        <button type="button" className={styles.primary} onClick={onPrimary}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
