"use client";

import { useTranslations } from "next-intl";
import { detectState } from "@/lib/state-detection";
import { getStateColor } from "@/lib/stateConfig";
import styles from "./mini-map.module.css";

type MiniMapProps = {
  x: number; // -1..1
  y: number; // -1..1
};

export function MiniMap({ x, y }: MiniMapProps) {
  const tMap = useTranslations("Map");
  const state = detectState(x, y);
  const color = getStateColor(state);
  const left = 50 + x * 42;
  const top = 50 - y * 42;

  return (
    <div className={styles.outer}>
      <div className={styles.wrap}>
        <div className={styles.quadrant} style={{ top: 0, left: 0, background: `${getStateColor("protecting")}18` }} />
        <div className={styles.quadrant} style={{ top: 0, right: 0, background: `${getStateColor("building")}18` }} />
        <div className={styles.quadrant} style={{ bottom: 0, left: 0, background: `${getStateColor("enduring")}18` }} />
        <div
          className={styles.quadrant}
          style={{ bottom: 0, right: 0, background: `${getStateColor("receiving")}18` }}
        />
        <div className={styles.axisH} />
        <div className={styles.axisV} />
        <div
          className={styles.dot}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            background: color,
            boxShadow: `0 0 10px 3px ${color}66`,
          }}
        />
      </div>
      <div className={styles.stateLabel} style={{ color }}>
        {tMap(`states.${state}.name`).toUpperCase()}
      </div>
    </div>
  );
}
