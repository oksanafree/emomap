"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useCheckin } from "@/lib/checkin-context";
import { useSliderSound } from "@/lib/use-slider-sound";
import { calcFont } from "@/lib/slider-math";
import styles from "@/styles/checkin-screen.module.css";

export default function WorldPage() {
  const t = useTranslations("World");
  const router = useRouter();
  const { setWorldValue } = useCheckin();
  const [value, setValue] = useState(50);
  const { startSlide, sndSlide, sndNav } = useSliderSound();

  function uww(v: number) {
    setValue(v);
    sndSlide(v);
  }

  function handleNext() {
    setWorldValue(value);
    sndNav();
    router.push("/self");
  }

  const dist = Math.abs(value - 50);
  const isAmbiguous = dist < 6;
  const fontSize = isAmbiguous ? 15 : calcFont(value);
  const opacity = isAmbiguous ? 0.5 : Number((0.4 + (dist / 50) * 0.6).toFixed(2));
  const liveWordKey = isAmbiguous ? "ambiguous" : value > 50 ? "favorable" : "against";

  return (
    <div className={styles.lightScreen}>
      <div className={styles.maxW}>
        <div className={styles.nav}>
          <Link href="/" className={styles.navBack}>
            ‹
          </Link>
          <div className={styles.navTitle}>{t("navTitle")}</div>
          <div className={styles.navSp} />
        </div>

        <div className={`${styles.catLbl} ${styles.catS}`}>{t("category")}</div>

        <div className={styles.qWrap}>
          <div className={styles.question}>
            {t.rich("question", { b: (chunks) => <b>{chunks}</b> })}
          </div>
        </div>

        <div className={styles.sliderArea}>
          <div
            className={`${styles.liveWord} ${styles.lwS}`}
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
            onChange={(e) => uww(Number(e.target.value))}
            onTouchStart={startSlide}
            onMouseDown={startSlide}
            className={styles.range}
          />
        </div>

        <div className={styles.endLabels}>
          <div className={styles.el}>
            <div className={styles.elMain}>{t("endLabels.leftMain")}</div>
            <div className={styles.elSub}>
              {t.rich("endLabels.leftSub", { br: () => <br /> })}
            </div>
          </div>
          <div className={`${styles.el} ${styles.r}`}>
            <div className={styles.elMain}>{t("endLabels.rightMain")}</div>
            <div className={styles.elSub}>
              {t.rich("endLabels.rightSub", { br: () => <br /> })}
            </div>
          </div>
        </div>

        <div className={styles.progDots}>
          <div className={`${styles.pdot} ${styles.on}`} />
          <div className={styles.pdot} />
        </div>

        <div className={styles.pb}>
          <button type="button" className={styles.btnMain} onClick={handleNext}>
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
