"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { useSliderSound } from "@/lib/use-slider-sound";
import { db, getFirebaseAuth } from "@/lib/firebase";
import type { StateKey } from "@/lib/state-detection";
import { AuthGuard } from "@/components/AuthGuard";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import mapStyles from "@/styles/map-visual.module.css";
import styles from "./history.module.css";

const NOTIF_ASKED_KEY = "notif_asked";
const INSTALL_PROMPT_SEEN_KEY = "install_prompt_seen";

type HistoryEntry = {
  id: string;
  timestamp: Date | null;
  world_value: number;
  self_value: number;
  x: number;
  y: number;
  state: StateKey;
};

export default function HistoryPage() {
  const t = useTranslations("History");
  const tMap = useTranslations("Map");
  const tInstall = useTranslations("Install");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAnonymousAuth();
  const { sndNav } = useSliderSound();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [cachedReport, setCachedReport] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (cancelled) return;
      const reportText = snap.data()?.report?.text;
      if (typeof reportText === "string" && reportText) {
        setCachedReport(reportText);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!entries || entries.length === 0) return;
    if (!localStorage.getItem(NOTIF_ASKED_KEY)) {
      setShowNotifPrompt(true);
    }
  }, [entries]);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone && !localStorage.getItem(INSTALL_PROMPT_SEEN_KEY)) {
      setShowIOSBanner(true);
    }
  }, []);

  function dismissIOSBanner() {
    localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, "true");
    setShowIOSBanner(false);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(query(collection(db, "users", user.uid, "entries"), orderBy("timestamp", "desc")))
      .then((snapshot) => {
        if (cancelled) return;
        setEntries(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null;
            return {
              id: doc.id,
              timestamp,
              world_value: data.world_value,
              self_value: data.self_value,
              x: data.x,
              y: data.y,
              state: data.state,
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function handleNewMoment() {
    sndNav();
    router.push("/world");
  }

  async function handleLogout() {
    setShowSettings(false);
    await signOut(getFirebaseAuth());
    router.push("/auth");
  }

  function handleEditContext(entryId: string) {
    setOpenMenuId(null);
    router.push(`/context?entryId=${entryId}`);
  }

  async function handleDelete(entryId: string) {
    setOpenMenuId(null);
    if (!user) return;
    if (!window.confirm(t("confirmDelete"))) return;

    setDeleteError(false);
    try {
      await deleteDoc(doc(db, "users", user.uid, "entries", entryId));
      setEntries((prev) => (prev ? prev.filter((e) => e.id !== entryId) : prev));
    } catch {
      setDeleteError(true);
    }
  }

  const dayCount = entries
    ? new Set(entries.filter((e) => e.timestamp).map((e) => e.timestamp!.toDateString())).size
    : 0;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AuthGuard>
      {showNotifPrompt && <NotificationPrompt onClose={() => setShowNotifPrompt(false)} />}
      {showSettings && (
        <>
          <div className={styles.settingsBackdrop} onClick={() => setShowSettings(false)} />
          <div className={styles.settingsSheet}>
            <button type="button" className={styles.settingsLogout} onClick={handleLogout}>
              {t("logOut")}
            </button>
          </div>
        </>
      )}
      <div className="flex min-h-screen flex-col bg-[#f7f6f4]">
        <div className={styles.histHdr}>
          <div className={styles.histTop}>
            <div className={styles.histTitle}>{t("title")}</div>
            <div className={styles.histTopActions}>
              <button type="button" className={styles.histNew} onClick={handleNewMoment}>
                {t("newMoment")}
              </button>
              <button
                type="button"
                className={styles.settingsBtn}
                aria-label="Settings"
                onClick={() => setShowSettings(true)}
              >
                ⚙
              </button>
            </div>
          </div>
          <div className={styles.histSub}>
            {entries && entries.length > 0
              ? `${t("entriesCount", { count: entries.length })} · ${t("daysCount", { count: dayCount })}`
              : " "}
          </div>
          {entries && entries.length > 0 && entries.length < 5 && (
            <div className={styles.histSub}>
              {t("progressToInsight", { count: entries.length, remaining: 5 - entries.length })}
            </div>
          )}
          {entries && entries.length >= 5 && (
            <Link href="/report?fresh=1" className={styles.histNew}>
              {t("seeReport")}
            </Link>
          )}
        </div>

        <div className={styles.histScroll}>
          {cachedReport && (
            <div className={styles.reportCard}>
              <p className={styles.reportCardText}>{cachedReport}</p>
              <Link href="/report?fresh=1" className={styles.regenerateLink}>
                {t("regenerate")}
              </Link>
            </div>
          )}
          {showIOSBanner && (
            <div className={styles.iosBanner}>
              <p className={styles.iosBannerText}>{tInstall("iosText")}</p>
              <button type="button" className={styles.iosBannerDismiss} onClick={dismissIOSBanner}>
                {tInstall("dismiss")}
              </button>
            </div>
          )}
          <div className={mapStyles.mapWrap}>
            <div className={mapStyles.axH} />
            <div className={mapStyles.axV} />
            <div className={mapStyles.ring} style={{ width: "23%", height: "23%" }} />
            <div className={mapStyles.ring} style={{ width: "46%", height: "46%" }} />
            <div className={mapStyles.ring} style={{ width: "70%", height: "70%" }} />
            <div className={mapStyles.ql} style={{ top: 8, left: 10 }}>
              {tMap("quadrants.protecting")}
            </div>
            <div className={mapStyles.ql} style={{ top: 8, right: 10 }}>
              {tMap("quadrants.building")}
            </div>
            <div className={mapStyles.ql} style={{ bottom: 8, left: 10 }}>
              {tMap("quadrants.enduring")}
            </div>
            <div className={mapStyles.ql} style={{ bottom: 8, right: 10 }}>
              {tMap("quadrants.receiving")}
            </div>
            {entries?.map((entry) => (
              <div
                key={entry.id}
                className={mapStyles.constellationDot}
                style={{
                  left: `${50 + entry.x * 42}%`,
                  top: `${50 - entry.y * 42}%`,
                }}
              />
            ))}
          </div>

          {authLoading || entries === null ? (
            <p className={styles.secLbl}>{t("loading")}</p>
          ) : error ? (
            <p className={styles.secLbl}>{t("error")}</p>
          ) : entries.length === 0 ? (
            <p className={styles.secLbl}>{t("empty")}</p>
          ) : (
            <>
              <div className={styles.secLbl}>{t("recent")}</div>
              {deleteError && <p className={styles.secLbl}>{t("deleteError")}</p>}
              {entries.map((entry) => (
                <div key={entry.id} className={styles.entryRow}>
                  <div className={styles.entryDot} />
                  <div className={styles.entryBody}>
                    <div className={styles.entryState}>
                      {tMap(`states.${entry.state}.name`).toUpperCase()}
                    </div>
                    <div className={styles.entryMeta}>
                      {entry.timestamp ? dateFormatter.format(entry.timestamp) : "—"}
                    </div>
                  </div>
                  <div className={styles.entryMenuWrap}>
                    <button
                      type="button"
                      className={styles.entryMenuBtn}
                      aria-label="More"
                      onClick={() => setOpenMenuId((id) => (id === entry.id ? null : entry.id))}
                    >
                      ···
                    </button>
                    {openMenuId === entry.id && (
                      <>
                        <div className={styles.entryMenuBackdrop} onClick={() => setOpenMenuId(null)} />
                        <div className={styles.entryMenu}>
                          <div
                            className={styles.entryMenuItem}
                            onClick={() => handleEditContext(entry.id)}
                          >
                            {t("editContext")}
                          </div>
                          <div
                            className={`${styles.entryMenuItem} ${styles.entryMenuItemDanger}`}
                            onClick={() => handleDelete(entry.id)}
                          >
                            {t("delete")}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
