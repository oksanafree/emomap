"use client";

import { useRef } from "react";

export function useSliderSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSlideRef = useRef(0);

  function getCtx() {
    if (!audioCtxRef.current) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AudioCtor();
    }
    return audioCtxRef.current;
  }

  // Mobile browsers create a *suspended* context on first use, and resume()
  // is async — scheduling oscillators before it resolves silently drops the
  // sound. Run the callback only once the context is actually running.
  function withRunningContext(play: (c: AudioContext) => void) {
    try {
      const c = getCtx();
      if (c.state === "running") {
        play(c);
      } else {
        c.resume().then(() => play(c));
      }
    } catch {
      // ignore — audio is a non-essential enhancement
    }
  }

  function startSlide() {
    try {
      const c = getCtx();
      if (c.state === "suspended") c.resume();
    } catch {
      // ignore — audio is a non-essential enhancement
    }
  }

  function sndSlide(v: number) {
    if (Date.now() - lastSlideRef.current < 80) return;
    lastSlideRef.current = Date.now();
    withRunningContext((c) => {
      const n = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.type = "sine";
      o.frequency.value = 260 + (v / 100) * 200;
      g.gain.setValueAtTime(0.04, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + 0.12);
      o.start(n);
      o.stop(n + 0.12);
    });
  }

  function sndNav() {
    withRunningContext((c) => {
      const n = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(300, n);
      o.frequency.exponentialRampToValueAtTime(460, n + 0.18);
      g.gain.setValueAtTime(0.06, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + 0.22);
      o.start(n);
      o.stop(n + 0.22);
    });
  }

  function sndLand() {
    withRunningContext((c) => {
      const n = c.currentTime;
      [0, 0.07, 0.14].forEach((d, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.type = "sine";
        o.frequency.value = [528, 660, 792][i];
        g.gain.setValueAtTime(0, n + d);
        g.gain.linearRampToValueAtTime(0.07, n + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, n + d + 0.75);
        o.start(n + d);
        o.stop(n + d + 0.75);
      });
    });
  }

  function sndChip() {
    withRunningContext((c) => {
      const n = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.type = "sine";
      o.frequency.value = 680;
      g.gain.setValueAtTime(0.03, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + 0.07);
      o.start(n);
      o.stop(n + 0.07);
    });
  }

  function sndSave() {
    withRunningContext((c) => {
      const n = c.currentTime;
      [0, 0.09, 0.18].forEach((d, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.type = "sine";
        o.frequency.value = [261, 329, 392][i];
        g.gain.setValueAtTime(0.05, n + d);
        g.gain.exponentialRampToValueAtTime(0.001, n + d + 0.65);
        o.start(n + d);
        o.stop(n + d + 0.65);
      });
    });
  }

  return { startSlide, sndSlide, sndNav, sndLand, sndChip, sndSave };
}
