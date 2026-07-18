"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export function LogoutButton() {
  const t = useTranslations("Common");
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setVisible(Boolean(user && !user.isAnonymous));
    });
    return () => unsubscribe();
  }, []);

  if (!visible) return null;

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.push("/auth");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="fixed right-2 top-[calc(env(safe-area-inset-top)+6px)] z-10 flex h-8 items-center px-2 text-xs font-medium text-[#7c6cf0] opacity-80"
    >
      {t("logOut")}
    </button>
  );
}
