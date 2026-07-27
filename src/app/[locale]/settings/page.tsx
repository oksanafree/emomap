"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteUser } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "./settings.module.css";

const BATCH_DELETE_SIZE = 450;

async function deleteAllUserData(uid: string) {
  const entriesSnap = await getDocs(collection(db, "users", uid, "entries"));
  const entryDocs = entriesSnap.docs;
  for (let i = 0; i < entryDocs.length; i += BATCH_DELETE_SIZE) {
    const batch = writeBatch(db);
    entryDocs.slice(i, i + BATCH_DELETE_SIZE).forEach((entryDoc) => batch.delete(entryDoc.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "users", uid));
}

function SettingsPageInner() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      // Firestore security rules gate access on request.auth.uid, so the
      // account's data must be deleted first, while still authenticated —
      // deleting the Auth user first would lock us out of our own cleanup.
      await deleteAllUserData(currentUser.uid);
      await deleteUser(currentUser);
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      router.push("/auth");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/requires-recent-login" ? t("reauthRequired") : t("deleteError"));
      setDeleting(false);
    }
  }

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/history" className={checkinStyles.navBack}>
            ‹
          </Link>
          <div className={checkinStyles.navTitle}>{t("navTitle")}</div>
          <div className={checkinStyles.navSp} />
        </div>

        <div className={styles.scroll}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>{t("dangerZone")}</p>
            <p className={styles.sectionHint}>{t("deleteAccountHint")}</p>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => {
                setError(null);
                setShowConfirm(true);
              }}
            >
              {t("deleteAccountButton")}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>

        {showConfirm && (
          <div className={styles.overlay}>
            <div className={styles.dialog}>
              <p className={styles.dialogMessage}>{t("deleteConfirmMessage")}</p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dialogConfirm}
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? t("deleting") : t("confirmDeleteButton")}
                </button>
                <button
                  type="button"
                  className={styles.dialogCancel}
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                >
                  {t("cancelButton")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageInner />
    </AuthGuard>
  );
}
