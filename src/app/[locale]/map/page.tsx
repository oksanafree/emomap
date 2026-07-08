"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useCheckin } from "@/lib/checkin-context";
import { useSliderSound } from "@/lib/use-slider-sound";
import { detectState } from "@/lib/state-detection";
import { AuthGuard } from "@/components/AuthGuard";
import checkinStyles from "@/styles/checkin-screen.module.css";
import styles from "@/styles/map-visual.module.css";
import emoStyles from "./emotion-chips.module.css";

export default function MapPage() {
  const t = useTranslations("Map");
  const locale = useLocale();
  const router = useRouter();
  const { worldValue, selfValue } = useCheckin();
  const { sndLand, sndNav, sndChip } = useSliderSound();

  const worldRaw = worldValue ?? 50;
  const selfRaw = selfValue ?? 50;
  const x = (worldRaw - 50) / 50;
  const y = (selfRaw - 50) / 50;
  const state = detectState(x, y);
  const px = 50 + x * 42;
  const py = 50 - y * 42;

  const [dotPos, setDotPos] = useState({ left: 50, top: 50, animate: false });

  useEffect(() => {
    setDotPos({ left: 50, top: 50, animate: false });
    const timeout = setTimeout(() => {
      setDotPos({ left: px, top: py, animate: true });
      sndLand();
    }, 80);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, py]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherSelected) {
      const timeout = setTimeout(() => otherInputRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [otherSelected]);

  function selectEmotion(index: number) {
    setSelectedIndex(index);
    setOtherSelected(false);
    sndChip();
  }

  function selectOther() {
    setOtherSelected(true);
    setSelectedIndex(null);
    sndChip();
  }

  function handleContinue() {
    sndNav();
    const params = new URLSearchParams({
      world_value: String(worldRaw),
      self_value: String(selfRaw),
      x: String(x),
      y: String(y),
      state,
    });
    const emotion = otherSelected
      ? otherText.trim()
      : selectedIndex !== null
        ? (t.raw(`emotions.${state}`) as string[])[selectedIndex]
        : "";
    if (emotion) params.set("emotion", emotion);
    router.push(`/context?${params.toString()}`);
  }

  const emotionLabels = t.raw(`emotions.${state}`) as string[];

  return (
    <AuthGuard>
      <div className={checkinStyles.lightScreen}>
        <div className={checkinStyles.maxW}>
          <div className={checkinStyles.nav}>
            <Link href="/self" className={checkinStyles.navBack}>
              ‹
            </Link>
            <div className={checkinStyles.navTitle}>{t("navTitle")}</div>
            <div className={checkinStyles.navSp} />
          </div>

          <div className={styles.mapWrap}>
            <div className={styles.axH} />
            <div className={styles.axV} />
            <div className={styles.ring} style={{ width: "23%", height: "23%" }} />
            <div className={styles.ring} style={{ width: "46%", height: "46%" }} />
            <div className={styles.ring} style={{ width: "70%", height: "70%" }} />
            <div className={styles.ql} style={{ top: 8, left: 10 }}>
              {t("quadrants.protecting")}
            </div>
            <div className={styles.ql} style={{ top: 8, right: 10 }}>
              {t("quadrants.building")}
            </div>
            <div className={styles.ql} style={{ bottom: 8, left: 10 }}>
              {t("quadrants.enduring")}
            </div>
            <div className={styles.ql} style={{ bottom: 8, right: 10 }}>
              {t("quadrants.receiving")}
            </div>
            <svg className={styles.mapSvg}>
              <circle cx="53%" cy="63%" r="4%" fill="rgba(255,255,255,0.12)" />
              <circle cx="37%" cy="57%" r="4.5%" fill="rgba(255,255,255,0.15)" />
              <circle cx="61%" cy="36%" r="5%" fill="rgba(255,255,255,0.18)" />
              <line
                x1="53%"
                y1="63%"
                x2="37%"
                y2="57%"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1.2"
                strokeDasharray="3,4"
              />
              <line
                x1="37%"
                y1="57%"
                x2="61%"
                y2="36%"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1.2"
                strokeDasharray="3,4"
              />
              <line
                x1="61%"
                y1="36%"
                x2={`${px}%`}
                y2={`${py}%`}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1.2"
                strokeDasharray="3,4"
              />
            </svg>
            <div
              className={styles.mdot}
              style={{
                left: `${dotPos.left}%`,
                top: `${dotPos.top}%`,
                transition: dotPos.animate ? undefined : "none",
              }}
            />
          </div>

          <div className={styles.yahRow}>
            <span className={styles.yahPre}>{t("youAreHere")}</span>
            <span className={styles.yahName}>{t(`states.${state}.name`).toUpperCase()}</span>
          </div>
          <div className={styles.yahSub}>{t(`states.${state}.sub`)}</div>

          <div className={emoStyles.emoArea}>
            <div className={emoStyles.emoQ}>{t("emotionQuestion")}</div>
            <div className={emoStyles.emoHint}>{t("emotionHint")}</div>
            <div className={emoStyles.chips}>
              {emotionLabels.map((label, i) => (
                <div
                  key={label}
                  className={`${emoStyles.chip} ${selectedIndex === i ? emoStyles.chipSelected : ""}`}
                  onClick={() => selectEmotion(i)}
                >
                  {label}
                </div>
              ))}
              <div
                className={`${emoStyles.chip} ${emoStyles.chipOther} ${otherSelected ? emoStyles.chipSelected : ""}`}
                onClick={selectOther}
              >
                {t("emotionOther")}
              </div>
            </div>
            {otherSelected && (
              <input
                ref={otherInputRef}
                type="text"
                className={emoStyles.otherInput}
                placeholder={t("emotionPlaceholder")}
                maxLength={locale === "ru" ? 80 : 60}
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}
          </div>

          <div className={checkinStyles.pb}>
            <button type="button" className={checkinStyles.btnMain} onClick={handleContinue}>
              {t("continue")}
            </button>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
