"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { subscribeUserToPush } from "@/lib/notifications";

// Browser/OS-level FCM token rotation can silently invalidate a token
// captured once at opt-in time — the app would otherwise keep sending push
// to a dead token forever with no visible error until it's eventually pruned
// server-side. Re-registers the current token on every app load for users
// who already granted notification permission (checking permission first so
// this never triggers an unwanted prompt for users who haven't opted in).
// Mounted once in the root locale layout, alongside SessionBridge.
export function PushTokenBridge() {
  const refreshedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      if (refreshedForUid.current === user.uid) return;
      if (Notification.permission !== "granted") return;

      refreshedForUid.current = user.uid;
      // subscribeUserToPush() awaits navigator.serviceWorker.ready, which
      // never resolves if nothing has registered the worker yet — normally
      // done by the history page, but this bridge can run first on a fresh
      // load elsewhere, so register (idempotently) here too.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
      }
      subscribeUserToPush();
    });
    return () => unsubscribe();
  }, []);

  return null;
}
