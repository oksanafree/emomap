"use client";

import { useAnonymousAuth } from "@/lib/use-anonymous-auth";

export function AuthStatus() {
  const { user, loading } = useAnonymousAuth();

  if (loading) {
    return <p className="text-xs text-black/40 dark:text-white/40">Signing in…</p>;
  }

  return (
    <p className="text-xs text-black/40 dark:text-white/40">
      Signed in anonymously as {user?.uid}
    </p>
  );
}
