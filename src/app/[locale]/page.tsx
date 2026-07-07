"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { OnboardingMap } from "@/components/onboarding-map";

const ONBOARDED_KEY = "em_onboarded";

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem(ONBOARDED_KEY)) {
      router.replace("/world");
    }
  }, [router]);

  function handleStart() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    router.push("/world");
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#080914] px-8 pt-[calc(env(safe-area-inset-top)+36px)]">
      <div className="flex flex-1 flex-col items-center justify-between">
        <div className="flex flex-col items-center gap-3">
          <OnboardingMap
            protectingLabel={t("quadrants.protecting")}
            buildingLabel={t("quadrants.building")}
            enduringLabel={t("quadrants.enduring")}
            receivingLabel={t("quadrants.receiving")}
          />
          <h1 className="text-center text-[34px] font-normal leading-tight tracking-tight text-[#e8e4ff]">
            {t("slogan")}
          </h1>
        </div>
        <p className="px-1 text-center text-base leading-relaxed text-[#4848a0]">
          {t("body")}
        </p>
      </div>
      <div className="w-full px-2 pb-[calc(env(safe-area-inset-bottom)+36px)] pt-6">
        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-2xl border border-[#6b5fd0] bg-[#4a3fa0] py-[18px] text-[17px] text-[#e0d8ff]"
        >
          {t("cta")}
        </button>
      </div>
    </div>
  );
}
