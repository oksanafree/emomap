"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { useSliderSound } from "@/lib/use-slider-sound";
import { db } from "@/lib/firebase";
import {
  ACTIVITY_KEYS,
  ENERGY_KEYS,
  HUNGER_KEYS,
  SLEEP_KEYS,
  SOCIAL_KEYS,
  type ActivityKey,
  type EnergyKey,
  type HungerKey,
  type SleepKey,
  type SocialKey,
} from "@/lib/context-options";
import type { StateKey } from "@/lib/state-detection";
import { AuthGuard } from "@/components/AuthGuard";
import { HomeNavIcon } from "@/components/HomeNavIcon";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "./context.module.css";

function ContextPageInner() {
  const t = useTranslations("Context");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAnonymousAuth();
  const { sndChip, sndSave } = useSliderSound();

  const worldValue = Number(searchParams.get("world_value")) || 50;
  const selfValue = Number(searchParams.get("self_value")) || 50;
  const x = Number(searchParams.get("x")) || 0;
  const y = Number(searchParams.get("y")) || 0;
  const state = (searchParams.get("state") as StateKey) || "Still";
  const entryId = searchParams.get("entryId");
  const isEditing = Boolean(entryId);

  const [emotion, setEmotion] = useState(searchParams.get("emotion") ?? "");
  const [activities, setActivities] = useState<Set<ActivityKey>>(new Set());
  const [social, setSocial] = useState<Set<SocialKey>>(new Set());
  const [sleep, setSleep] = useState<SleepKey | null>(null);
  const [energy, setEnergy] = useState<EnergyKey | null>(null);
  const [hunger, setHunger] = useState<HungerKey | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(isEditing);

  const stateQuestions = t.raw(`stateQuestions.${state}`) as string[];
  const [questionIndex] = useState(() => Math.floor(Math.random() * stateQuestions.length));
  const noteQuestion = stateQuestions[questionIndex] ?? "";

  useEffect(() => {
    console.log("[context] state question check", {
      stateFromUrl: searchParams.get("state"),
      resolvedState: state,
      stateQuestions,
      questionIndex,
      noteQuestion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!entryId || !user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid, "entries", entryId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const tokens = snap.data().custom_tokens ?? {};
        const toArray = (value: unknown): string[] =>
          Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];

        if (tokens.emotion) setEmotion(tokens.emotion);
        setActivities(new Set(toArray(tokens.activity) as ActivityKey[]));
        setSocial(new Set(toArray(tokens.social) as SocialKey[]));
        setSleep((tokens.sleep as SleepKey) ?? null);
        setEnergy((tokens.energy as EnergyKey) ?? null);
        setHunger((tokens.hunger as HungerKey) ?? null);
        if (typeof tokens.note === "string") setNote(tokens.note);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntry(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId, user]);

  function toggleActivity(key: ActivityKey) {
    setActivities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    sndChip();
  }

  function toggleSocial(key: SocialKey) {
    setSocial((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    sndChip();
  }

  function selectSleep(key: SleepKey) {
    setSleep(key);
    sndChip();
  }

  function selectEnergy(key: EnergyKey) {
    setEnergy(key);
    sndChip();
  }

  function selectHunger(key: HungerKey) {
    setHunger(key);
    sndChip();
  }

  async function handleSave() {
    if (!user || saving || loadingEntry) return;
    setSaving(true);
    setError(null);
    sndSave();

    const customTokens: Record<string, unknown> = {};
    if (emotion) customTokens.emotion = emotion;
    if (activities.size > 0) customTokens.activity = Array.from(activities);
    if (social.size > 0) customTokens.social = Array.from(social);
    if (sleep) customTokens.sleep = sleep;
    if (energy) customTokens.energy = energy;
    if (hunger) customTokens.hunger = hunger;
    if (note.trim()) customTokens.note = note.trim();

    const entriesRef = collection(db, "users", user.uid, "entries");

    if (isEditing && entryId) {
      try {
        await updateDoc(doc(db, "users", user.uid, "entries", entryId), {
          custom_tokens: customTokens,
        });
      } catch {
        setError(t("saveError"));
        setSaving(false);
        return;
      }
      router.push("/history");
      return;
    }

    try {
      await addDoc(entriesRef, {
        timestamp: serverTimestamp(),
        world_value: worldValue,
        self_value: selfValue,
        x,
        y,
        state,
        lang: locale,
        custom_tokens: customTokens,
      });
    } catch {
      setError(t("saveError"));
      setSaving(false);
      return;
    }

    try {
      const count = (await getCountFromServer(entriesRef)).data().count;
      const shouldTrigger = count % 5 === 0;
      console.log("[context] report generation trigger check", { entryCount: count, triggered: shouldTrigger });
      if (shouldTrigger) {
        fetch("/api/report/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid, locale }),
        }).catch(() => {});
      }
    } catch {
      // Non-fatal: the entry is already saved, report regeneration is best-effort.
    }

    router.push("/history");
  }

  return (
    <>
      <HomeNavIcon />
      <div className={checkinStyles.lightScreen}>
        <div className={checkinStyles.maxW}>
          <div className={checkinStyles.nav}>
            <Link href={isEditing ? "/history" : "/map"} className={checkinStyles.navBack}>
              ‹
            </Link>
            <div className={checkinStyles.navTitle}>{t("navTitle")}</div>
            <div className={checkinStyles.navSp} />
          </div>

          <div className={styles.ctxHint}>{t("hint")}</div>

          <div className={styles.ctxScroll}>
            <div className={styles.ctxSec}>
              <div className={styles.ctxLbl}>{t("whatWho")}</div>
              <div className={styles.ctxQ}>
                {t("activityQuestion")} <span className={styles.ctxQHint}>{t("activityHint")}</span>
              </div>
              <div className={styles.ctxChips}>
                {ACTIVITY_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${activities.has(key) ? styles.ccSelected : ""}`}
                    onClick={() => toggleActivity(key)}
                  >
                    {t(`activities.${key}`)}
                  </div>
                ))}
              </div>

              <div className={styles.ctxGap} />
              <div className={styles.ctxQ}>{t("socialQuestion")}</div>
              <div className={styles.ctxChips}>
                {SOCIAL_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${social.has(key) ? styles.ccSelected : ""}`}
                    onClick={() => toggleSocial(key)}
                  >
                    {t(`social.${key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.ctxDiv} />

            <div className={styles.ctxSec}>
              <div className={styles.ctxLbl}>{t("bodyState")}</div>
              <div className={styles.ctxQ}>{t("sleepQuestion")}</div>
              <div className={styles.ctxChips}>
                {SLEEP_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${sleep === key ? styles.ccSelected : ""}`}
                    onClick={() => selectSleep(key)}
                  >
                    {t(`sleep.${key}`)}
                  </div>
                ))}
              </div>

              <div className={styles.ctxGap} />
              <div className={styles.ctxQ}>{t("energyQuestion")}</div>
              <div className={styles.ctxChips}>
                {ENERGY_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${energy === key ? styles.ccSelected : ""}`}
                    onClick={() => selectEnergy(key)}
                  >
                    {t(`energy.${key}`)}
                  </div>
                ))}
              </div>

              <div className={styles.ctxGap} />
              <div className={styles.ctxQ}>{t("hungerQuestion")}</div>
              <div className={styles.ctxChips}>
                {HUNGER_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${hunger === key ? styles.ccSelected : ""}`}
                    onClick={() => selectHunger(key)}
                  >
                    {t(`hunger.${key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.noteSection}>
              <p className={styles.noteQuestion}>{noteQuestion}</p>
              <textarea
                className={styles.noteTextarea}
                placeholder={t("notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className={styles.saveWrap}>
            {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
            <button
              type="button"
              className={styles.btnSave}
              onClick={handleSave}
              disabled={!user || saving || loadingEntry}
            >
              {t("save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ContextPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <ContextPageInner />
      </Suspense>
    </AuthGuard>
  );
}
