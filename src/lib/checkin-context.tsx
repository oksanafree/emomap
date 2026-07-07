"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CheckinContextValue = {
  worldValue: number | null;
  setWorldValue: (value: number) => void;
  selfValue: number | null;
  setSelfValue: (value: number) => void;
};

const CheckinContext = createContext<CheckinContextValue | null>(null);

export function CheckinProvider({ children }: { children: ReactNode }) {
  const [worldValue, setWorldValue] = useState<number | null>(null);
  const [selfValue, setSelfValue] = useState<number | null>(null);

  const value = useMemo(
    () => ({ worldValue, setWorldValue, selfValue, setSelfValue }),
    [worldValue, selfValue],
  );

  return <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>;
}

export function useCheckin() {
  const ctx = useContext(CheckinContext);
  if (!ctx) {
    throw new Error("useCheckin must be used within a CheckinProvider");
  }
  return ctx;
}
