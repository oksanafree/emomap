"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

// Mints/refreshes the server-side session cookie whenever the Firebase
// client SDK reports a signed-in, non-anonymous user. Needed because the
// cookie only started being minted at sign-in/login time — anyone who was
// already signed in before that shipped (still a valid session per the
// client SDK) would otherwise have no cookie and get bounced by
// middleware's route protection on /world, /self, /context, /history,
// /report until they explicitly logged out and back in. Mounted once in
// the root locale layout so it runs on first load regardless of which page
// a returning user lands on first.
export function SessionBridge() {
  const mintedForUid = useRef<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) return;
      if (mintedForUid.current === user.uid) return;
      mintedForUid.current = user.uid;

      try {
        const idToken = await user.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch (err) {
        console.error("Failed to refresh session cookie", err);
        mintedForUid.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  return null;
}
