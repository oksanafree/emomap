"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "@/i18n/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setAuthorized(true);
      } else {
        router.replace("/auth");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!authorized) return null;
  return <>{children}</>;
}
