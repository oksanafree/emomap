import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import * as logger from "firebase-functions/logger";
import {
  EMAIL_FROM,
  WELCOME_EMAIL_FROM,
  REMINDER_CONTENT,
  WELCOME_CONTENT,
  INSTALL_PROMPT_CONTENT,
  buildReminderEmailContent,
  buildWelcomeEmailContent,
  buildInstallPromptEmailContent,
  resolveLocale,
  type Locale,
} from "./email-templates";

initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");

// The UTC instant corresponding to 00:00:00 today in `timeZone`. Used to
// decide whether a user's latest entry happened "today" (calendar day in
// the app's home time zone) rather than just "recently".
function startOfTodayUtc(timeZone: string): Date {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now); // "YYYY-MM-DD"
  const midnightUtcGuess = new Date(`${todayStr}T00:00:00Z`);
  const asTz = new Date(midnightUtcGuess.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(midnightUtcGuess.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtc.getTime() - asTz.getTime();
  return new Date(midnightUtcGuess.getTime() + offsetMs);
}

async function sendReminders() {
  const db = getFirestore();
  const messaging = getMessaging();
  const resend = new Resend(resendApiKey.value());
  const fourHoursAgo = Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000);
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = Timestamp.fromDate(startOfTodayUtc("America/New_York"));

  // Not filtered by notifications_enabled here — that flag only gates push.
  // Email eligibility is judged purely on check-in activity below, so it can
  // reach users who never turned push on at all.
  const usersSnapshot = await db.collection("users").get();

  await Promise.all(
    usersSnapshot.docs.map(async (userDoc) => {
      const data = userDoc.data();
      const content = REMINDER_CONTENT[resolveLocale(data.locale)];

      const latestEntrySnap = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("entries")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
      const latestEntryTimestamp = latestEntrySnap.empty
        ? null
        : (latestEntrySnap.docs[0].data().timestamp as Timestamp | undefined) ?? null;

      const checkedInLast4Hours =
        latestEntryTimestamp !== null && latestEntryTimestamp.toMillis() >= fourHoursAgo.toMillis();
      const activeLast7Days =
        latestEntryTimestamp !== null && latestEntryTimestamp.toMillis() >= sevenDaysAgo.toMillis();
      const checkedInToday =
        latestEntryTimestamp !== null && latestEntryTimestamp.toMillis() >= todayStart.toMillis();

      // Push — unchanged eligibility (opted in, has a token, not active in
      // the last 4 hours).
      if (data.notifications_enabled === true && !checkedInLast4Hours) {
        const tokensArray = (data.fcm_tokens as string[] | undefined) ?? [];
        const legacyToken = data.fcm_token as string | undefined;
        const usingLegacyTokenOnly = tokensArray.length === 0 && !!legacyToken;
        const fcmTokens = tokensArray.length > 0 ? tokensArray : legacyToken ? [legacyToken] : [];

        if (fcmTokens.length > 0) {
          const staleTokens: string[] = [];

          await Promise.all(
            fcmTokens.map(async (token) => {
              try {
                await messaging.send({
                  token,
                  notification: { title: content.subject, body: content.body },
                  data: { url: "/history" },
                });
              } catch (error) {
                if ((error as { code?: string }).code === "messaging/registration-token-not-registered") {
                  staleTokens.push(token);
                } else {
                  logger.error(`Failed to send push reminder to ${userDoc.id}`, error);
                }
              }
            }),
          );

          if (staleTokens.length > 0) {
            if (usingLegacyTokenOnly) {
              await userDoc.ref.update({ fcm_token: FieldValue.delete() });
            } else {
              await userDoc.ref.update({ fcm_tokens: FieldValue.arrayRemove(...staleTokens) });
            }
          }
        }
      }

      // Email fallback — sent to every active-in-the-last-7-days user who
      // hasn't checked in today, regardless of push status.
      if (activeLast7Days && !checkedInToday) {
        try {
          const userRecord = await getAuth().getUser(userDoc.id);
          if (!userRecord.email) return;

          const { text: emailText, html: emailHtml } = buildReminderEmailContent(content);
          const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: userRecord.email,
            subject: content.subject,
            text: emailText,
            html: emailHtml,
          });
          if (error) {
            logger.error(`Failed to send reminder email to ${userDoc.id}`, error);
          }
        } catch (error) {
          logger.error(`Failed to send reminder email to ${userDoc.id}`, error);
        }
      }
    }),
  );
}

export const dailyReminder = onSchedule(
  { schedule: "0 12 * * *", timeZone: "America/New_York", secrets: [resendApiKey] },
  async () => {
    await sendReminders();
  },
);

async function sendWelcomeEmailToUser(uid: string, email: string, locale: Locale) {
  const content = WELCOME_CONTENT[locale];
  const { html, text } = buildWelcomeEmailContent(content);
  const resend = new Resend(resendApiKey.value());

  try {
    const { error } = await resend.emails.send({
      from: WELCOME_EMAIL_FROM,
      to: email,
      subject: content.subject,
      text,
      html,
    });
    if (error) {
      logger.error(`Failed to send welcome email to ${uid}`, error);
    }
  } catch (error) {
    logger.error(`Failed to send welcome email to ${uid}`, error);
  }
}

// auth.user().onCreate fires for every new Firebase Auth user, including
// anonymous sessions (the app creates one automatically on first visit) —
// those are filtered out below since anonymous users have no email. Note
// this does NOT fire when an existing anonymous user upgrades to a real
// account via linkWithCredential (that reuses the same uid rather than
// creating a new one), so signups that start anonymous are instead caught
// by sendPendingWelcomeEmail below, via the welcome_email_pending flag the
// client sets right after linkWithCredential succeeds.
export const sendWelcomeEmail = functionsV1
  .runWith({ secrets: [resendApiKey] })
  .auth.user()
  .onCreate(async (user) => {
    if (!user.email) return;

    let locale: Locale = "en";
    try {
      const snap = await getFirestore().collection("users").doc(user.uid).get();
      locale = resolveLocale(snap.data()?.locale);
    } catch (error) {
      logger.error(`Failed to read locale for welcome email (${user.uid})`, error);
    }

    await sendWelcomeEmailToUser(user.uid, user.email, locale);
  });

// Companion to sendWelcomeEmail for the linkWithCredential signup path,
// which reuses the existing (anonymous) uid and never fires
// auth.user().onCreate. The client flags users/{userId}.welcome_email_pending
// = true right after a successful link; this picks that up, sends the same
// welcome email, then clears the flag. The beforeData check guards against
// the update this function itself makes (pending -> false) re-triggering it.
export const sendPendingWelcomeEmail = onDocumentUpdated(
  { document: "users/{userId}", secrets: [resendApiKey] },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!afterData || afterData.welcome_email_pending !== true) return;
    if (beforeData?.welcome_email_pending === true) return;

    const userId = event.params.userId;

    try {
      const userRecord = await getAuth().getUser(userId);
      if (userRecord.email) {
        await sendWelcomeEmailToUser(userId, userRecord.email, resolveLocale(afterData.locale));
      }
    } catch (error) {
      logger.error(`Failed to send pending welcome email to ${userId}`, error);
    }

    await event.data!.after.ref.update({ welcome_email_pending: false });
  },
);

// Fires on every new entry, but only ever sends once per user: gated on the
// install_prompt_email_sent flag, which is only set after a successful send.
// Anonymous users have no email (getUser().email is undefined) and are
// skipped without setting the flag, so a user who checks in anonymously
// before signing up still gets the prompt on their first entry after a real
// email exists, instead of never getting it at all.
export const sendInstallPromptEmail = onDocumentCreated(
  { document: "users/{userId}/entries/{entryId}", secrets: [resendApiKey] },
  async (event) => {
    const userId = event.params.userId;
    const db = getFirestore();
    const userRef = db.collection("users").doc(userId);

    try {
      const userSnap = await userRef.get();
      const userData = userSnap.data();
      if (userData?.install_prompt_email_sent === true) return;

      const userRecord = await getAuth().getUser(userId);
      if (!userRecord.email) return;

      const content = INSTALL_PROMPT_CONTENT[resolveLocale(userData?.locale)];
      const { html, text } = buildInstallPromptEmailContent(content);
      const resend = new Resend(resendApiKey.value());

      const { error } = await resend.emails.send({
        from: WELCOME_EMAIL_FROM,
        to: userRecord.email,
        subject: content.subject,
        text,
        html,
      });

      if (error) {
        logger.error(`Failed to send install-prompt email to ${userId}`, error);
        return;
      }

      await userRef.set({ install_prompt_email_sent: true }, { merge: true });
    } catch (error) {
      logger.error(`Failed to send install-prompt email to ${userId}`, error);
    }
  },
);
