import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

initializeApp();

type ReminderVariant = "morning" | "evening";

const MORNING_MESSAGES = [
  { title: "How's your morning?", body: "Take 10 seconds to check in on Emomapp." },
  { title: "Start the day with a check-in", body: "Where are you right now — in the world, and in yourself?" },
];

const EVENING_MESSAGES = [
  { title: "How was today?", body: "Log tonight's check-in before you wind down." },
  { title: "End-of-day check-in", body: "A quick moment to notice how today landed." },
];

function pickMessage(variant: ReminderVariant) {
  const pool = variant === "morning" ? MORNING_MESSAGES : EVENING_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function sendReminders(variant: ReminderVariant) {
  const db = getFirestore();
  const messaging = getMessaging();
  const fourHoursAgo = Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000);
  const message = pickMessage(variant);

  const usersSnapshot = await db.collection("users").where("notifications_enabled", "==", true).get();

  await Promise.all(
    usersSnapshot.docs.map(async (userDoc) => {
      const data = userDoc.data();
      const tokensArray = (data.fcm_tokens as string[] | undefined) ?? [];
      const legacyToken = data.fcm_token as string | undefined;
      const usingLegacyTokenOnly = tokensArray.length === 0 && !!legacyToken;
      const fcmTokens = tokensArray.length > 0 ? tokensArray : legacyToken ? [legacyToken] : [];
      if (fcmTokens.length === 0) return;

      const recentEntries = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("entries")
        .where("timestamp", ">=", fourHoursAgo)
        .limit(1)
        .get();

      if (!recentEntries.empty) return;

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
              logger.error(`Failed to send reminder to ${userDoc.id}`, error);
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
    }),
  );
}

export const morningReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/New_York" },
  async () => {
    await sendReminders("morning");
  },
);

export const eveningReminder = onSchedule(
  { schedule: "0 20 * * *", timeZone: "America/New_York" },
  async () => {
    await sendReminders("evening");
  },
);
