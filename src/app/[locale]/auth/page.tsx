"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "@/i18n/navigation";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { AGE_RANGE_KEYS, GENDER_KEYS, type AgeRangeKey, type GenderKey } from "@/lib/profile-options";
import styles from "./auth.module.css";

type Mode = "signup" | "login";
type Step = "form" | "profile";

function AuthPageInner() {
  const t = useTranslations("Auth");
  const tProfile = useTranslations("Profile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "login" ? "login" : "signup");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [gender, setGender] = useState<GenderKey | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRangeKey | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get("from") === "onboarding" && localStorage.getItem("em_onboarded")) {
      setShowBack(true);
    }
  }, [searchParams]);

  function handleBack() {
    localStorage.removeItem("em_onboarded");
    router.push("/");
  }

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
        setSubmitting(false);
        setStep("profile");
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err) {
      setError(mapError((err as { code?: string }).code));
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === "signup" ? "login" : "signup"));
    setError(null);
  }

  async function handleProfileContinue() {
    setProfileSaving(true);
    const uid = getFirebaseAuth().currentUser?.uid;
    if (uid) {
      const profile: Record<string, string> = {};
      if (gender) profile.gender = gender;
      if (ageRange) profile.age_range = ageRange;
      if (Object.keys(profile).length > 0) {
        try {
          await setDoc(doc(db, "users", uid), profile, { merge: true });
        } catch {
          // Non-fatal — profile fields are optional, proceed regardless.
        }
      }
    }
    router.push("/world");
  }

  function handleProfileSkip() {
    router.push("/world");
  }

  return (
    <div className={styles.screen}>
      {showBack && (
        <button type="button" onClick={handleBack} aria-label="Back" className={styles.backButton}>
          ‹
        </button>
      )}
      <div className={styles.wordmark}>EMOMAP</div>
      {step === "form" ? (
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
      ) : (
        <div className={styles.content}>
          <div className={styles.profileQ}>
            <div className={styles.profileLabel}>{tProfile("genderQuestion")}</div>
            <div className={styles.chips}>
              {GENDER_KEYS.map((key) => (
                <div
                  key={key}
                  className={`${styles.chip} ${gender === key ? styles.chipSelected : ""}`}
                  onClick={() => setGender(key)}
                >
                  {tProfile(`gender.${key}`)}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.profileQ}>
            <div className={styles.profileLabel}>{tProfile("ageQuestion")}</div>
            <div className={styles.chips}>
              {AGE_RANGE_KEYS.map((key) => (
                <div
                  key={key}
                  className={`${styles.chip} ${ageRange === key ? styles.chipSelected : ""}`}
                  onClick={() => setAgeRange(key)}
                >
                  {tProfile(`age.${key}`)}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.submit}
            onClick={handleProfileContinue}
            disabled={profileSaving}
          >
            {tProfile("continue")}
          </button>

          <button type="button" className={styles.toggle} onClick={handleProfileSkip}>
            {tProfile("skip")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
