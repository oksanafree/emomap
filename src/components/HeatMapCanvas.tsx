"use client";

import { useEffect, useRef } from "react";
import styles from "./heat-map-canvas.module.css";

const RADIUS_PX = 50;
const PEAK_ALPHA = 0.12;

type HeatPoint = { x: number; y: number; color: string };

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export function HeatMapCanvas({ points }: { points: HeatPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const size = canvas!.clientWidth;
      if (size === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = size * dpr;
      canvas!.height = size * dpr;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      for (const point of points) {
        const { r, g, b } = hexToRgb(point.color);
        const cx = ((50 + point.x * 42) / 100) * size;
        const cy = ((50 - point.y * 42) / 100) * size;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, RADIUS_PX);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${PEAK_ALPHA})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS_PX, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [points]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
