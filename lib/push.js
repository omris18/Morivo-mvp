"use client";
import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { app, db, firebaseConfigured } from "./firebase";

export const pushSupported =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "Notification" in window &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

async function requestPushToken() {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Push notifications aren't configured yet.");
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Push notifications aren't supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) {
    throw new Error("Could not get a push token from the browser.");
  }
  return token;
}

export async function enablePushNotifications(experienceId, uid) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  const token = await requestPushToken();
  await updateDoc(doc(db, "experiences", experienceId, "participants", uid), { pushToken: token });
  return token;
}

// The organizer isn't a row in the participants subcollection, so their token lives directly
// on the experience document instead - only the owner can write it (see firestore.rules).
export async function enableOrganizerPushNotifications(experienceId) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  const token = await requestPushToken();
  await updateDoc(doc(db, "experiences", experienceId), { organizerPushToken: token });
  return token;
}
