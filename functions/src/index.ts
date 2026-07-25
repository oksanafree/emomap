import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from "firebase-functions/v1";
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

// Distinct from EMAIL_FROM (reminders@) — the welcome email intentionally
// sends from a different local part on the same verified domain.
const WELCOME_EMAIL_FROM = "Emomapp <reminder@emomapp.app>";
const WELCOME_URL = "https://emomapp.app";

type WelcomeContent = {
  subject: string;
  paragraphs: string[];
  ctaLabel: string;
  signature: string;
};

const WELCOME_CONTENT: Record<Locale, WelcomeContent> = {
  en: {
    subject: "Welcome to Emomapp",
    paragraphs: [
      "Welcome to Emomapp. Most apps ask how you feel. Emomapp asks how is the situation impacting you — and how are you impacting it?",
      "Instead of labeling emotions, you place yourself on a map. Two axes, a few taps, and you've captured your state in the moment.",
      "The magic happens over time. Check in a few times a day — morning, after a hard meeting, before bed — and Emomapp begins to calculate your trajectory.",
      "Patterns you'd never notice on your own start to surface: that your energy drops on Sundays, that tension at work always follows poor sleep, that you're more resilient than you think.",
      "No other app does this - because no one asked the right question until now.",
      "Your first check-in takes 30 seconds.",
    ],
    ctaLabel: "Open Emomapp",
    signature: "Oksana",
  },
  ru: {
    subject: "Добро пожаловать в Эмокарту",
    paragraphs: [
      "Добро пожаловать в Эмокарту. Большинство приложений спрашивают, как ты себя чувствуешь. Эмокарта спрашивает как обстоятельства влияют на тебя — и как ты влияешь на них?",
      "Вместо того чтобы называть эмоции, ты отмечаешь себя на карте твоего внутреннего мира. Две шкалы, несколько кликов — и координаты состояния зафиксированы.",
      "Но главное происходит со временем. Отмечайся несколько раз в день — утром, после сложной встречи, перед сном — и Эмокарта начнёт вычислять твою траекторию.",
      "Начинают проявляться паттерны, которые сложно заметить самому: что энергия особенно падает по воскресеньям, что напряжение на работе всегда следует за плохим сном, что ты устойчивее, чем думаешь.",
      "Ни одно другое приложение этого не делает, потому что никто до сих пор не задавал правильного вопроса.",
      "Первая отметка займёт 30 секунд.",
    ],
    ctaLabel: "Открыть Эмокарту",
    signature: "Оксана",
  },
};

function buildWelcomeEmailContent(content: WelcomeContent) {
  const html = [
    ...content.paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
    `<p><a href="${WELCOME_URL}">${content.ctaLabel}</a></p>`,
    `<p>${content.signature}</p>`,
  ].join("");
  const text = [...content.paragraphs, `${content.ctaLabel}: ${WELCOME_URL}`, content.signature].join("\n\n");
  return { html, text };
}

// auth.user().onCreate fires for every new Firebase Auth user, including
// anonymous sessions (the app creates one automatically on first visit) —
// those are filtered out below since anonymous users have no email. Note
// this does NOT fire when an existing anonymous user upgrades to a real
// account via linkWithCredential (that reuses the same uid rather than
// creating a new one), so users who try the app anonymously before signing
// up will not receive this email through this trigger.
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

    const content = WELCOME_CONTENT[locale];
    const { html, text } = buildWelcomeEmailContent(content);
    const resend = new Resend(resendApiKey.value());

    try {
      const { error } = await resend.emails.send({
        from: WELCOME_EMAIL_FROM,
        to: user.email,
        subject: content.subject,
        text,
        html,
      });
      if (error) {
        logger.error(`Failed to send welcome email to ${user.uid}`, error);
      }
    } catch (error) {
      logger.error(`Failed to send welcome email to ${user.uid}`, error);
    }
  });
