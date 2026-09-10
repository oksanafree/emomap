import { getMessaging, getToken } from "firebase/messaging";
import { arrayUnion, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp, db, getFirebaseAuth } from "./firebase";

type PushMessageHandler = { postMessage: (message: unknown) => void };

// The native iOS Xcode wrapper injects WKScriptMessageHandlers onto
// window.webkit.messageHandlers. When they're present we're running inside
// the wrapper's WKWebView (not a Safari tab / home-screen PWA), so push must
// go through the native bridge — Firebase FCM web push is unavailable there.
function getNativePushHandlers(): Record<string, PushMessageHandler> | null {
  if (typeof window === "undefined") return null;
  const handlers = (
    window as unknown as {
      webkit?: { messageHandlers?: Record<string, PushMessageHandler> };
    }
  ).webkit?.messageHandlers;
  if (handlers?.["push-permission-request"] && handlers?.["push-subscribe"]) {
    return handlers;
  }
  return null;
}

// True when the app is running inside the native iOS wrapper, where push is
// handled by the native bridge rather than Firebase FCM web push.
export function isNativePushWrapper(): boolean {
  return getNativePushHandlers() !== null;
}

export async function subscribeUserToPush(): Promise<boolean> {
  const nativeHandlers = getNativePushHandlers();
  if (nativeHandlers) {
    try {
      // Fire-and-forget to the native wrapper: request OS permission, then
      // subscribe. The wrapper owns the APNs token and persists it server-side
      // once the user grants permission, so there's no token to write here.
      nativeHandlers["push-permission-request"].postMessage({});
      nativeHandlers["push-subscribe"].postMessage({});
      console.log("[subscribeUserToPush] native wrapper -> posted push-permission-request + push-subscribe");
      return true;
    } catch (err) {
      console.error("[subscribeUserToPush] native wrapper bridge failed:", err);
      return false;
    }
  }

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
