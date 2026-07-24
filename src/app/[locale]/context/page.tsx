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
  ENGAGEMENT_KEYS,
  SOCIAL_KEYS,
  type ActivityKey,
  type EngagementLevel,
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
  const { startSlide, sndChip, sndSave } = useSliderSound();

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
  const [mentalEngagement, setMentalEngagement] = useState<EngagementLevel | null>(null);
  const [physicalEngagement, setPhysicalEngagement] = useState<EngagementLevel | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [hunger, setHunger] = useState<number | null>(null);
  const [bodyNote, setBodyNote] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(isEditing);

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
        setMentalEngagement((tokens.mental_engagement as EngagementLevel) ?? null);
        setPhysicalEngagement((tokens.physical_engagement as EngagementLevel) ?? null);
        setSleep(typeof tokens.sleep === "number" ? tokens.sleep : null);
        setEnergy(typeof tokens.energy === "number" ? tokens.energy : null);
        setHunger(typeof tokens.hunger === "number" ? tokens.hunger : null);
        if (typeof tokens.note === "string") setNote(tokens.note);
        if (typeof tokens.body_note === "string") setBodyNote(tokens.body_note);
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

  function selectMentalEngagement(key: EngagementLevel) {
    setMentalEngagement(key);
    sndChip();
  }

  function selectPhysicalEngagement(key: EngagementLevel) {
    setPhysicalEngagement(key);
    sndChip();
  }

  function selectSleep(value: number) {
    setSleep(value);
    sndChip();
  }

  function selectEnergy(value: number) {
    setEnergy(value);
    sndChip();
  }

  function selectHunger(value: number) {
    setHunger(value);
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
    if (mentalEngagement) customTokens.mental_engagement = mentalEngagement;
    if (physicalEngagement) customTokens.physical_engagement = physicalEngagement;
    if (sleep !== null) customTokens.sleep = sleep;
    if (energy !== null) customTokens.energy = energy;
    if (hunger !== null) customTokens.hunger = hunger;
    if (bodyNote.trim()) customTokens.body_note = bodyNote.trim();
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
      const generationType: "short" | "full" | null =
        count === 5 ? "short" : count >= 20 && count % 20 === 0 ? "full" : null;
      console.log("[context] report generation trigger check", { entryCount: count, triggered: generationType });
      if (generationType) {
        fetch("/api/report/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid, locale, type: generationType }),
        }).catch(() => {});
      }
      router.push(`/checkin-done?count=${count}`);
      return;
    } catch {
      // Non-fatal: the entry is already saved, report regeneration is best-effort.
    }

    router.push("/history");
  }

  function handleDiscard() {
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
                {t("activityQuestion")}
                {t("activityHint") && <span className={styles.ctxQHint}> {t("activityHint")}</span>}
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
              <div className={styles.ctxLbl}>{t("engagementLabel")}</div>
              <div className={styles.ctxQ}>{t("mentalEngagementLabel")}</div>
              <div className={styles.ctxChips}>
                {ENGAGEMENT_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${mentalEngagement === key ? styles.ccSelected : ""}`}
                    onClick={() => selectMentalEngagement(key)}
                  >
                    {t(`engagement.${key}`)}
                  </div>
                ))}
              </div>

              <div className={styles.ctxGap} />
              <div className={styles.ctxQ}>{t("physicalEngagementLabel")}</div>
              <div className={styles.ctxChips}>
                {ENGAGEMENT_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`${styles.cc} ${physicalEngagement === key ? styles.ccSelected : ""}`}
                    onClick={() => selectPhysicalEngagement(key)}
                  >
                    {t(`engagement.${key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.ctxDiv} />

            <div className={styles.ctxSec}>
              <div className={styles.ctxLbl}>{t("bodyState")}</div>

              <div className={styles.ctxSliderRow}>
                <div className={styles.ctxQ}>{t("sleepQuestion")}</div>
                {sleep !== null && (
                  <div className={styles.ctxSliderValue}>{t("sleepValue", { hours: sleep })}</div>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={sleep ?? 5}
                onChange={(e) => selectSleep(Number(e.target.value))}
                onTouchStart={startSlide}
                onMouseDown={startSlide}
                className={styles.ctxRange}
              />
              <div className={styles.ctxSliderEdges}>
                <span>{t("sleepMinLabel")}</span>
                <span>{t("sleepMaxLabel")}</span>
              </div>

              <div className={styles.ctxGap} />
              <div className={styles.ctxSliderRow}>
                <div className={styles.ctxQ}>{t("energyQuestion")}</div>
                {energy !== null && <div className={styles.ctxSliderValue}>{energy}</div>}
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={energy ?? 5}
                onChange={(e) => selectEnergy(Number(e.target.value))}
                onTouchStart={startSlide}
                onMouseDown={startSlide}
                className={styles.ctxRange}
              />

              <div className={styles.ctxGap} />
              <div className={styles.ctxSliderRow}>
                <div className={styles.ctxQ}>{t("hungerQuestion")}</div>
                {hunger !== null && <div className={styles.ctxSliderValue}>{hunger}</div>}
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={hunger ?? 5}
                onChange={(e) => selectHunger(Number(e.target.value))}
                onTouchStart={startSlide}
                onMouseDown={startSlide}
                className={styles.ctxRange}
              />
              <div className={styles.ctxSliderEdges}>
                <span>{t("hungerMinLabel")}</span>
                <span>{t("hungerMaxLabel")}</span>
              </div>
            </div>

            <div className={styles.noteSection}>
              <p className={styles.noteQuestion}>{t("physicalPrompt")}</p>
              <textarea
                className={styles.noteTextarea}
                placeholder={t("physicalPlaceholder")}
                value={bodyNote}
                onChange={(e) => setBodyNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className={styles.noteSection}>
              <p className={styles.noteQuestion}>{t("noteQuestion")}</p>
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
            <button type="button" className={styles.discardLink} onClick={handleDiscard}>
              {t("discard")}
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
