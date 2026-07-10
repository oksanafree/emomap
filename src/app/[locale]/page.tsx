"use client";

import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { useTranslations } from "next-intl";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "@/i18n/navigation";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { OnboardingMap } from "@/components/onboarding-map";
import { TrailMap } from "@/components/trail-map";
import { OnboardingSliderPreview } from "@/components/onboarding-slider-preview";
import { OnboardingMilestones } from "@/components/onboarding-milestones";

const ONBOARDED_KEY = "em_onboarded";
const TOTAL_STEPS = 4;
const SWIPE_THRESHOLD = 50;

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const tHome = useTranslations("home");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [reportCheckStatus, setReportCheckStatus] = useState<"checking" | "found" | "none">("checking");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolved || !localStorage.getItem(ONBOARDED_KEY)) return;
    if (authUser && !authUser.isAnonymous) {
      setShowLanding(true);
    } else {
      router.replace("/auth");
    }
  }, [authResolved, authUser, router]);

  useEffect(() => {
    if (!showLanding || !authUser) return;
    let cancelled = false;
    // The report is stored per-language as report_en / report_ru fields on the
    // users/{userId} document itself (written by /api/report/generate via
    // `.set({ [`report_${locale}`]: {...} }, { merge: true })`), not a
    // users/{userId}/report subcollection document. The landing button just
    // checks whether a report exists in either language — /report itself
    // handles generating a fresh one in the current locale if only the other
    // language's report exists.
    getDoc(doc(db, "users", authUser.uid))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        const enText = data?.report_en?.text;
        const ruText = data?.report_ru?.text;
        const found =
          (typeof enText === "string" && enText.length > 0) ||
          (typeof ruText === "string" && ruText.length > 0);
        console.log("[landing] report check", { uid: authUser.uid, docExists: snap.exists(), found });
        setReportCheckStatus(found ? "found" : "none");
      })
      .catch((err) => {
        console.log("[landing] report check failed", { uid: authUser.uid, error: err });
        if (!cancelled) setReportCheckStatus("none");
      });
    return () => {
      cancelled = true;
    };
  }, [showLanding, authUser]);

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleStart() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    if (authUser && !authUser.isAnonymous) {
      router.push("/world");
    } else {
      router.push("/auth?from=onboarding");
    }
  }

  function handleLogin() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    router.push("/auth?mode=login&from=onboarding");
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX < -SWIPE_THRESHOLD) goNext();
    else if (deltaX > SWIPE_THRESHOLD) goBack();
  }

  const mapLabels = {
    protectingLabel: t("quadrants.protecting"),
    buildingLabel: t("quadrants.building"),
    enduringLabel: t("quadrants.enduring"),
    receivingLabel: t("quadrants.receiving"),
  };

  if (showLanding) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#080914] px-8 pt-[calc(env(safe-area-inset-top)+56px)]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#7c6cf0] shadow-[0_0_14px_rgba(124,108,240,0.5)]" />
          <div className="text-xs font-semibold tracking-[0.22em] text-[#6868b0]">EMOMAPP</div>
          <p className="text-[15px] text-[#6868b0]">{tHome("tagline")}</p>
        </div>
        <div className="w-full px-2 pb-[calc(env(safe-area-inset-bottom)+36px)]">
          <button
            type="button"
            onClick={() => router.push("/world")}
            className="w-full rounded-2xl border border-[#6b5fd0] bg-[#4a3fa0] py-[18px] text-[17px] text-[#e0d8ff]"
          >
            {t("checkInNow")}
          </button>
          {reportCheckStatus === "checking" && (
            <div className="mt-3 h-[54px] w-full animate-pulse rounded-2xl border border-[#241f3d] bg-[#12102d]" />
          )}
          {reportCheckStatus === "found" && (
            <button
              type="button"
              onClick={() => router.push("/report")}
              className="mt-3 w-full rounded-2xl border border-[#3a3468] bg-transparent py-[18px] text-[17px] text-[#6868b0]"
            >
              {tHome("viewReport")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center bg-[#080914] px-8 pt-[calc(env(safe-area-inset-top)+56px)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {step > 0 && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="absolute left-2 top-[calc(env(safe-area-inset-top)+20px)] flex h-11 w-11 items-center justify-center text-2xl text-[#4848a0]"
        >
          ‹
        </button>
      )}

      <button
        type="button"
        onClick={handleLogin}
        className="absolute right-6 top-[calc(env(safe-area-inset-top)+32px)] text-sm text-[#6868b0]"
      >
        {t("login")}
      </button>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {step === 0 && <OnboardingMap {...mapLabels} />}
        {step === 1 && (
          <OnboardingSliderPreview
            worldLabel={t("sliderLabels.world")}
            selfLabel={t("sliderLabels.self")}
          />
        )}
        {step === 2 && <TrailMap {...mapLabels} />}
        {step === 3 && (
          <OnboardingMilestones
            firstLabel={t("milestones.first")}
            secondLabel={t("milestones.second")}
          />
        )}
        <h1 className="text-center text-[32px] font-light leading-tight tracking-[-0.02em] text-[#e8e4ff]">
          {t(`steps.${step}.headline`)}
        </h1>
        <p className="max-w-[300px] text-center text-[17px] leading-[1.7] text-[#6868b0]">
          {t(`steps.${step}.body`)}
        </p>
      </div>

      <div className="flex items-center gap-[10px] pb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === step ? "bg-[#7c6cf0]" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      <div className="w-full px-2 pb-[calc(env(safe-area-inset-bottom)+36px)]">
        <button
          type="button"
          onClick={step === TOTAL_STEPS - 1 ? handleStart : goNext}
          className="w-full rounded-2xl border border-[#6b5fd0] bg-[#4a3fa0] py-[18px] text-[17px] text-[#e0d8ff]"
        >
          {step === TOTAL_STEPS - 1 ? t("start") : t("next")}
        </button>
      </div>
    </div>
  );
}
