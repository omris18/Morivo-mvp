importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// Public Firebase web config - safe to hardcode here, same values already
// shipped in the client bundle. Security comes from Firestore/Storage rules,
// not from hiding this. Service workers can't read Next.js env vars, so this
// file can't be generated from .env.local at request time.
firebase.initializeApp({
  apiKey: "AIzaSyA9QvjdyYyVEKlTMuTHOfD7AhF-CcIVUSE",
  authDomain: "morivo-mvp.firebaseapp.com",
  projectId: "morivo-mvp",
  storageBucket: "morivo-mvp.firebasestorage.app",
  messagingSenderId: "1018467228668",
  appId: "1:1018467228668:web:8231bba17eb7d63e253079",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Morivo";
  const body = payload.notification?.body || "";
  self.registration.showNotification(title, { body });
});
