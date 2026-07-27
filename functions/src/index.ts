import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
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

// Distinct from EMAIL_FROM (reminders@emomapp.app) — the welcome email
// sends from reminder@ on the mail. subdomain verified in Resend.
const WELCOME_EMAIL_FROM = "Emomapp <reminder@mail.emomapp.app>";

type WelcomeContent = {
  subject: string;
  intro: string;
  questionsIntro: string;
  bullets: [string, string];
  paragraph2: string;
  paragraph3: string;
  closing: string;
  signatureName: string;
  telegramText: string;
  telegramUrl: string;
};

const WELCOME_CONTENT: Record<Locale, WelcomeContent> = {
  en: {
    subject: "Welcome to Emomapp",
    intro: "Emomapp doesn't measure how you feel — it measures how you move.",
    questionsIntro: "Most apps ask you to rate your mood. Emomapp asks two different questions:",
    bullets: ["How is the situation impacting you right now?", "How are you impacting the situation?"],
    paragraph2:
      "Your answers place a dot on a 2D map. Check in a few times today — after a meeting, a meal, when the energy shifts. The trajectory between dots is where the insight lives.",
    paragraph3: "After 5 check-ins, your first pattern report appears. After 20, the full picture.",
    closing: "Welcome to your map.",
    signatureName: "Emomapp",
    telegramText: "Join our community:",
    telegramUrl: "https://t.me/+gpylW64kg_lkOTUx",
  },
  ru: {
    subject: "Добро пожаловать в Эмокарту",
    intro: "Эмокарта не измеряет, что ты чувствуешь — она измеряет, как ты движешься.",
    questionsIntro: "Большинство приложений просят оценить настроение. Эмокарта задаёт два других вопроса:",
    bullets: ["Как обстоятельства влияют на тебя прямо сейчас?", "Как ты влияешь на обстоятельства?"],
    paragraph2:
      "Твои ответы — точка на двумерной карте. Отметься несколько раз сегодня — после встречи, еды, смены состояния. Траектория между точками — это и есть инсайт.",
    paragraph3: "После 5 отметок появится твой первый отчёт о паттернах. После 20 — полная картина.",
    closing: "Добро пожаловать на свою карту.",
    signatureName: "Эмокарта",
    telegramText: "Присоединяйся к сообществу:",
    telegramUrl: "https://t.me/+CNtztWwlF6syODlh",
  },
};

function buildWelcomeEmailContent(content: WelcomeContent) {
  const bulletsHtml = `<ul>${content.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>`;
  const bulletsText = content.bullets.map((bullet) => `· ${bullet}`).join("\n");

  const html = [
    `<p>${content.intro}</p>`,
    `<p>${content.questionsIntro}</p>`,
    bulletsHtml,
    `<p>${content.paragraph2}</p>`,
    `<p>${content.paragraph3}</p>`,
    `<p>${content.closing}<br/>— ${content.signatureName}</p>`,
    `<p>${content.telegramText} <a href="${content.telegramUrl}">${content.telegramUrl}</a></p>`,
  ].join("");

  const text = [
    content.intro,
    `${content.questionsIntro}\n${bulletsText}`,
    content.paragraph2,
    content.paragraph3,
    `${content.closing}\n— ${content.signatureName}`,
    `${content.telegramText} ${content.telegramUrl}`,
  ].join("\n\n");

  return { html, text };
}

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
