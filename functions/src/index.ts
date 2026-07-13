import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import * as logger from "firebase-functions/logger";

initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");

// Requires a domain (or subdomain, e.g. mail.emomapp.app) verified in the
// Resend dashboard — until that's done, sends from this address will fail.
const EMAIL_FROM = "Emomapp <reminders@emomapp.app>";
const EMAIL_SUBJECT = "How are you right now?";
const APP_URL = "https://emomapp.app";

type ReminderVariant = "morning" | "evening";

const MORNING_MESSAGES = [
  { title: "How's your morning?", body: "Take 10 seconds to check in on Emomapp." },
  { title: "Start the day with a check-in", body: "Where are you right now — in the world, and in yourself?" },
  { title: "How are you showing up today?", body: "Take a moment to check in." },
  {
    title: "A new day, a new point on your trail.",
    body: "How does the world feel this morning?",
  },
];

const EVENING_MESSAGES = [
  { title: "How was today?", body: "Log tonight's check-in before you wind down." },
  { title: "End-of-day check-in", body: "A quick moment to notice how today landed." },
  { title: "How did the day treat you?", body: "Log your last state before it slips away." },
  { title: "Your trail is waiting.", body: "A quick check-in takes 30 seconds." },
];

function pickMessage(variant: ReminderVariant) {
  const pool = variant === "morning" ? MORNING_MESSAGES : EVENING_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

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

function buildEmailContent(message: { title: string; body: string }) {
  const text = `${message.title}\n\n${message.body}\n\nCheck in: ${APP_URL}`;
  const html = `<p>${message.title}</p><p>${message.body}</p><p><a href="${APP_URL}">Check in on Emomapp</a></p>`;
  return { text, html };
}

async function sendReminders(variant: ReminderVariant) {
  const db = getFirestore();
  const messaging = getMessaging();
  const resend = new Resend(resendApiKey.value());
  const fourHoursAgo = Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000);
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = Timestamp.fromDate(startOfTodayUtc("America/New_York"));
  const message = pickMessage(variant);
  const { text: emailText, html: emailHtml } = buildEmailContent(message);

  // Not filtered by notifications_enabled here — that flag only gates push.
  // Email eligibility is judged purely on check-in activity below, so it can
  // reach users who never turned push on at all.
  const usersSnapshot = await db.collection("users").get();

  await Promise.all(
    usersSnapshot.docs.map(async (userDoc) => {
      const data = userDoc.data();

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
                  notification: { title: message.title, body: message.body },
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

          const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: userRecord.email,
            subject: EMAIL_SUBJECT,
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

export const morningReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/New_York", secrets: [resendApiKey] },
  async () => {
    await sendReminders("morning");
  },
);

export const eveningReminder = onSchedule(
  { schedule: "0 20 * * *", timeZone: "America/New_York", secrets: [resendApiKey] },
  async () => {
    await sendReminders("evening");
  },
);
