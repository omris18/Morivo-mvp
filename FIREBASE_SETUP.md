# Firebase setup for Morivo

1. Create/open a Firebase project.
2. Add a Web app in Project Settings > General.
3. Enable Authentication > Sign-in method > Anonymous.
4. Create Cloud Firestore in production mode.
5. Copy `firestore.rules` into Firestore > Rules and publish.
6. Copy the six values from the Firebase Web config into Vercel:
   - NEXT_PUBLIC_FIREBASE_API_KEY
   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - NEXT_PUBLIC_FIREBASE_APP_ID
7. Redeploy Vercel.

After setup, the badge at the top changes from:
"Demo mode · Firebase not connected"
to:
"Firebase connected · Realtime mode".
