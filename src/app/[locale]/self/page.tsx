"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useCheckin } from "@/lib/checkin-context";
import { useSliderSound } from "@/lib/use-slider-sound";
import { calcFont } from "@/lib/slider-math";
import { AuthGuard } from "@/components/AuthGuard";
import { HomeNavIcon } from "@/components/HomeNavIcon";
import styles from "@/styles/checkin-screen.module.css";

export default function SelfPage() {
  const t = useTranslations("Self");
  const router = useRouter();
  const { setSelfValue } = useCheckin();
  const [value, setValue] = useState(50);
  const { startSlide, sndSlide, sndNav } = useSliderSound();

  function uss(v: number) {
    setValue(v);
    sndSlide(v);
  }

  function handleShowResult() {
    setSelfValue(value);
    sndNav();
    router.push("/map");
  }

  const dist = Math.abs(value - 50);
  const isAmbiguous = dist < 6;
  const fontSize = isAmbiguous ? 15 : calcFont(value);
  const opacity = isAmbiguous ? 0.5 : Number((0.4 + (dist / 50) * 0.6).toFixed(2));
  const liveWordKey = isAmbiguous ? "ambiguous" : value > 50 ? "active" : "passive";

  return (
    <AuthGuard>
      <HomeNavIcon />
      <div className={styles.lightScreen}>
        <div className={styles.maxW}>
          <div className={styles.nav}>
            <Link href="/world" className={styles.navBack}>
              ‹
            </Link>
            <div className={styles.navTitle}>{t("navTitle")}</div>
            <div className={styles.navSp} />
          </div>

          <div className={`${styles.catLbl} ${styles.catY}`}>{t("category")}</div>

          <div className={styles.qWrap}>
            <div className={styles.question}>
              {t.rich("question", { b: (chunks) => <b>{chunks}</b> })}
            </div>
          </div>

          <div className={styles.sliderArea}>
            <div
              className={`${styles.liveWord} ${styles.lwY}`}
              style={{ fontSize, opacity }}
            >
              {t(`liveWord.${liveWordKey}`)}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => uss(Number(e.target.value))}
              onTouchStart={startSlide}
              onMouseDown={startSlide}
              className={styles.range}
            />
          </div>

          <div className={styles.endLabels}>
            <div className={`${styles.el} ${styles.elBig}`}>
              <div className={`${styles.elSub} ${styles.elSubBig}`}>
                {(t.raw("endLabels.leftSub") as string[]).map((word) => (
                  <div key={word}>{word}</div>
                ))}
              </div>
            </div>
            <div className={`${styles.el} ${styles.r} ${styles.elBig}`}>
              <div className={`${styles.elSub} ${styles.elSubBig}`}>
                {(t.raw("endLabels.rightSub") as string[]).map((word) => (
                  <div key={word}>{word}</div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.progDots}>
            <div className={styles.pdot} />
            <div className={`${styles.pdot} ${styles.on}`} />
          </div>

          <div className={styles.pb}>
            <button type="button" className={styles.btnMain} onClick={handleShowResult}>
              {t("cta")}
            </button>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
