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

type Locale = "en" | "ru";

const REMINDER_CONTENT: Record<Locale, { subject: string; body: string; cta: string; url: string }> = {
  en: {
    subject: "Mark yourself on Emomapp",
    body: "Hey! This is a reminder to log your mood on Emomapp. The best time to check in is right after something shifts — a difficult conversation, a burst of energy or a moment of calm. Open Emomapp when you feel it and add a note. The more you check in, the more detailed your report becomes.",
    cta: "Check in now →",
    url: "https://emomapp.app/en",
  },
  ru: {
    subject: "Отметься на Эмокарте",
    body: "Здравствуйте. Это напоминание зайти на Эмокарту и отметить ваше состояние. Лучший момент для отметки — сразу после того, как что-то изменилось. Тяжёлый разговор, прилив энергии или неожиданное спокойствие. Откройте Emomapp когда ощущаете, что пора. Чем чаще вы отмечаетесь на Эмокарте, тем подробнее будет отчёт о ваших скрытых тенденциях.",
    cta: "Отметиться →",
    url: "https://emomapp.app/ru",
  },
};

function resolveLocale(value: unknown): Locale {
  return value === "ru" ? "ru" : "en";
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

function buildEmailContent(content: (typeof REMINDER_CONTENT)[Locale]) {
  const text = `${content.subject}\n\n${content.body}\n\n${content.cta} ${content.url}`;
  const html = `<p>${content.body}</p><p><a href="${content.url}">${content.cta}</a></p>`;
  return { text, html };
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

          const { text: emailText, html: emailHtml } = buildEmailContent(content);
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
