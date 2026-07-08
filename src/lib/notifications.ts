import { getMessaging, getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
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
    if (token && auth.currentUser) {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { fcm_token: token, notifications_enabled: true },
        { merge: true },
      );
    }
  } catch (err) {
    console.log("Push subscription failed silently:", err);
  }
}
