"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { addDoc, collection, getCountFromServer, serverTimestamp } from "firebase/firestore";
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
  const emotion = searchParams.get("emotion") ?? "";

  const [activities, setActivities] = useState<Set<ActivityKey>>(new Set());
  const [social, setSocial] = useState<Set<SocialKey>>(new Set());
  const [sleep, setSleep] = useState<SleepKey | null>(null);
  const [energy, setEnergy] = useState<EnergyKey | null>(null);
  const [hunger, setHunger] = useState<HungerKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!user || saving) return;
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

    const entriesRef = collection(db, "users", user.uid, "entries");
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
      router.push(count === 5 ? "/insight" : "/history");
    } catch {
      router.push("/history");
    }
  }

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className={checkinStyles.nav}>
          <Link href="/map" className={checkinStyles.navBack}>
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
        </div>

        <div className={styles.saveWrap}>
          {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSave}
            disabled={!user || saving}
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
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
