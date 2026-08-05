"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Link, useRouter } from "@/i18n/navigation";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { AGE_RANGE_KEYS, GENDER_KEYS, type AgeRangeKey, type GenderKey } from "@/lib/profile-options";
import styles from "./auth.module.css";

type Mode = "signup" | "login";
type Step = "form" | "profile";

const CONSENT_POLICY_VERSION = "2026-07";

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
  const [consentTermsPrivacy, setConsentTermsPrivacy] = useState(false);
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);

  const allConsentsChecked = consentTermsPrivacy && consentDataProcessing;

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

  async function mintSessionCookie(user: User) {
    const idToken = await user.getIdToken();
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && !allConsentsChecked) {
      setError(t("consent.error"));
      return;
    }

    setSubmitting(true);
    const auth = getFirebaseAuth();

    try {
      if (mode === "signup") {
        let signedUpUser: User;
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          const credential = EmailAuthProvider.credential(email, password);
          signedUpUser = (await linkWithCredential(auth.currentUser, credential)).user;
          // linkWithCredential reuses the existing (anonymous) uid rather than
          // creating a new Auth user, so it never fires the auth.user().onCreate
          // trigger that normally sends the welcome email. Flag it here instead
          // so the sendPendingWelcomeEmail Firestore trigger picks it up.
          try {
            await setDoc(doc(db, "users", signedUpUser.uid), { welcome_email_pending: true }, { merge: true });
          } catch (err) {
            console.error("Failed to flag pending welcome email", err);
          }
        } else {
          signedUpUser = (await createUserWithEmailAndPassword(auth, email, password)).user;
        }

        try {
          await setDoc(
            doc(db, "users", signedUpUser.uid),
            {
              // A freshly signed-up user has already seen the intro carousel
              // before reaching this screen. Mark onboarding complete here so
              // the landing/routing logic in page.tsx never sends them back
              // through the intro pages a second time.
              onboarding_complete: true,
              consents: {
                terms_and_privacy: {
                  accepted: true,
                  policy_version: CONSENT_POLICY_VERSION,
                  accepted_at: serverTimestamp(),
                },
                data_processing: {
                  accepted: true,
                  policy_version: CONSENT_POLICY_VERSION,
                  accepted_at: serverTimestamp(),
                },
              },
            },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to record signup consent", err);
        }

        await mintSessionCookie(signedUpUser);
        setSubmitting(false);
        setStep("profile");
        return;
      }
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await mintSessionCookie(user);
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
    // Send the new user straight into their first check-in (first slider),
    // not back to the home/intro flow.
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

            {mode === "signup" && (
              <div className={styles.consentGroup}>
                <label className={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={consentTermsPrivacy}
                    onChange={(e) => setConsentTermsPrivacy(e.target.checked)}
                  />
                  <span>
                    {t.rich("consent.termsPrivacy", {
                      termsLink: (chunks) => (
                        <Link href="/terms" target="_blank" rel="noopener noreferrer">
                          {chunks}
                        </Link>
                      ),
                      privacyLink: (chunks) => (
                        <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                <label className={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={consentDataProcessing}
                    onChange={(e) => setConsentDataProcessing(e.target.checked)}
                  />
                  <span>
                    {t.rich("consent.dataProcessing", {
                      privacyLink: (chunks) => (
                        <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.submit}
              disabled={submitting || (mode === "signup" && !allConsentsChecked)}
            >
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
