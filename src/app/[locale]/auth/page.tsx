"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "@/i18n/navigation";
import { getFirebaseAuth } from "@/lib/firebase";
import styles from "./auth.module.css";

type Mode = "signup" | "login";

export default function AuthPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function mapError(code: string | undefined): string {
    switch (code) {
      case "auth/email-already-in-use":
        return t("errors.emailInUse");
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return t("errors.wrongPassword");
      case "auth/user-not-found":
        return t("errors.noAccount");
      case "auth/weak-password":
        return t("errors.weakPassword");
      case "auth/invalid-email":
        return t("errors.invalidEmail");
      default:
        return t("errors.generic");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const auth = getFirebaseAuth();

    try {
      if (mode === "signup") {
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          const credential = EmailAuthProvider.credential(email, password);
          await linkWithCredential(auth.currentUser, credential);
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/world");
    } catch (err) {
      setError(mapError((err as { code?: string }).code));
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === "signup" ? "login" : "signup"));
    setError(null);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.wordmark}>EMOMAP</div>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          {mode === "signup" ? t("signupHeadline") : t("loginHeadline")}
        </h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? t("hidePassword") : t("showPassword")}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? t("submitting") : mode === "signup" ? t("createAccount") : t("logIn")}
          </button>
        </form>

        <button type="button" className={styles.toggle} onClick={toggleMode}>
          {mode === "signup" ? t("toggleToLogin") : t("toggleToSignup")}
        </button>
      </div>
    </div>
  );
}
