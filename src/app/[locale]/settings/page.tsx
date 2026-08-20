"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteUser } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { AuthGuard } from "@/components/AuthGuard";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "./settings.module.css";

const BATCH_DELETE_SIZE = 450;

type Gender = "f" | "m" | null;

// Stored as "f" | "m" | null. Also normalizes the legacy signup values
// ("female" | "male") so an existing profile shows the right selection.
function normalizeGender(value: unknown): Gender {
  if (value === "f" || value === "female") return "f";
  if (value === "m" || value === "male") return "m";
  return null;
}

const GENDER_OPTIONS: { value: Gender; key: "f" | "m" | "none" }[] = [
  { value: "f", key: "f" },
  { value: "m", key: "m" },
  { value: null, key: "none" },
];

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
  const { user } = useAnonymousAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>(null);
  const [genderLoaded, setGenderLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        setGender(normalizeGender(snap.data()?.gender));
        setGenderLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setGenderLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function selectGender(value: Gender) {
    if (!user) return;
    setGender(value);
    try {
      await setDoc(doc(db, "users", user.uid), { gender: value }, { merge: true });
    } catch (err) {
      console.error("Failed to save gender", err);
    }
  }

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
            <p className={styles.sectionLabel}>{t("genderLabel")}</p>
            <p className={styles.sectionHint}>{t("genderHint")}</p>
            <div className={styles.chips}>
              {GENDER_OPTIONS.map(({ value, key }) => (
                <div
                  key={key}
                  className={`${styles.chip} ${genderLoaded && gender === value ? styles.chipSelected : ""}`}
                  onClick={() => selectGender(value)}
                >
                  {t(`gender.${key}`)}
                </div>
              ))}
            </div>
          </div>

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
