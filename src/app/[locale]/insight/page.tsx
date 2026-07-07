"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useRouter } from "@/i18n/navigation";
import { useAnonymousAuth } from "@/lib/use-anonymous-auth";
import { useSliderSound } from "@/lib/use-slider-sound";
import { db } from "@/lib/firebase";
import type { StateKey } from "@/lib/state-detection";
import checkinStyles from "@/styles/checkin-screen.module.css";

function mostFrequentState(states: StateKey[]): StateKey {
  const counts = new Map<StateKey, number>();
  for (const s of states) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = states[0];
  let bestCount = 0;
  for (const s of states) {
    const count = counts.get(s)!;
    if (count > bestCount) {
      bestCount = count;
      best = s;
    }
  }
  return best;
}

export default function InsightPage() {
  const t = useTranslations("Insight");
  const tMap = useTranslations("Map");
  const router = useRouter();
  const { user } = useAnonymousAuth();
  const { sndNav } = useSliderSound();
  const [topState, setTopState] = useState<StateKey | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDocs(
      query(collection(db, "users", user.uid, "entries"), orderBy("timestamp", "desc"), limit(5)),
    ).then((snapshot) => {
      if (cancelled) return;
      const states = snapshot.docs.map((doc) => doc.data().state as StateKey);
      if (states.length > 0) setTopState(mostFrequentState(states));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function handleContinue() {
    sndNav();
    router.push("/history");
  }

  return (
    <div className={checkinStyles.lightScreen}>
      <div className={checkinStyles.maxW}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg text-[#6a6870]">{t("headline")}</p>
          {topState && (
            <>
              <p className="text-3xl font-bold tracking-wide text-[#1a1815]">
                {tMap(`states.${topState}.name`).toUpperCase()}
              </p>
              <p className="text-base text-[#b0adb8]">{t(`descriptions.${topState}`)}</p>
            </>
          )}
        </div>

        <div className={checkinStyles.pb}>
          <button
            type="button"
            className={checkinStyles.btnMain}
            onClick={handleContinue}
            disabled={!topState}
          >
            {t("cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
