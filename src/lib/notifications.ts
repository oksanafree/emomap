import { getMessaging, getToken } from "firebase/messaging";
import { arrayUnion, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp, db, getFirebaseAuth } from "./firebase";

export async function subscribeUserToPush(): Promise<boolean> {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    console.log(
      "[subscribeUserToPush] NEXT_PUBLIC_FIREBASE_VAPID_KEY ->",
      vapidKey ? `${vapidKey.slice(0, 8)}... (${vapidKey.length} chars)` : vapidKey,
    );
    if (!vapidKey) {
      console.error("[subscribeUserToPush] VAPID key is undefined — aborting before getToken().");
      return false;
    }

    const auth = getFirebaseAuth();
    const messaging = getMessaging(firebaseApp);
    const reg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    console.log("[subscribeUserToPush] getToken() ->", token ? `${token.slice(0, 12)}...` : token);

    if (!token) {
      console.error("[subscribeUserToPush] No FCM token returned — aborting before write.");
      return false;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error("[subscribeUserToPush] auth.currentUser is null — aborting before write.");
      return false;
    }

    const userRef = doc(db, "users", user.uid);
    const existingSnap = await getDoc(userRef);
    console.log(
      "[subscribeUserToPush] getDoc(userRef) -> exists:",
      existingSnap.exists(),
      "uid:",
      user.uid,
    );

    await setDoc(
      userRef,
      { fcm_tokens: arrayUnion(token), fcm_token: token, notifications_enabled: true },
      { merge: true },
    );
    console.log(
      "[subscribeUserToPush] setDoc() complete — token added to fcm_tokens and set as fcm_token for uid:",
      user.uid,
    );
    return true;
  } catch (err) {
    console.error("[subscribeUserToPush] failed:", err);
    return false;
  }
}
