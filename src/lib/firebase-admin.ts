import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!encoded) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is not set. Add the base64-encoded " +
        "Firebase service account JSON to .env.local to enable server-side Firestore access.",
    );
  }
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
}

let adminApp: App | undefined;

export function getAdminApp(): App {
  if (!adminApp) {
    adminApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(loadServiceAccount()) });
  }
  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
