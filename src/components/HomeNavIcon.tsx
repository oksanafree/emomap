"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function HomeNavIcon() {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      aria-label={t("home")}
      className="fixed left-2 top-[calc(env(safe-area-inset-top)+6px)] z-10 flex h-8 w-8 items-center justify-center"
    >
      <span className="block h-[9px] w-[9px] rounded-full bg-[#7c6cf0] opacity-70" />
    </button>
  );
}
