# Morivo MVP v2 — Firebase Storage setup

1. Firebase Console → Build → Storage.
2. Click Get started.
3. Choose the same region as Firestore when possible.
4. Finish creating the bucket.
5. Open Storage → Rules.
6. Replace the rules with storage.rules and Publish.
7. Open Firestore → Rules, replace with the new firestore.rules and Publish.

No new Vercel environment variables are required. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is already configured.

Test: Publish an experience → join from a second device → choose a photo → Upload & Complete Mission → organizer Runtime should show it immediately → Memory should show the same photo.
