import { getMessaging, getToken } from "firebase/messaging";
import { arrayUnion, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp, db, getFirebaseAuth } from "./firebase";

export async function subscribeUserToPush() {
  try {
    const auth = getFirebaseAuth();
    const messaging = getMessaging(firebaseApp);
    const reg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    console.log("[subscribeUserToPush] getToken() ->", token ? `${token.slice(0, 12)}...` : token);

    if (!token) {
      console.error("[subscribeUserToPush] No FCM token returned — aborting before write.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error("[subscribeUserToPush] auth.currentUser is null — aborting before write.");
      return;
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
  } catch (err) {
    console.error("[subscribeUserToPush] failed:", err);
  }
}
