"use client";
import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { app, db, firebaseConfigured } from "./firebase";

export const pushSupported =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "Notification" in window &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

export async function enablePushNotifications(experienceId, uid) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
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

  await updateDoc(doc(db, "experiences", experienceId, "participants", uid), { pushToken: token });
  return token;
}
