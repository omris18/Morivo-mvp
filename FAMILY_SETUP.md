# Family memory books: production prerequisite

The family feature is deployed. Family invitations, participant identities and Firestore isolation have been validated. Production Storage uploads and family-book isolation were verified on 2026-11-15 after the administrator granted the service agent role below. Firebase CLI 14 skips cross-service IAM setup in non-interactive mode.

Already completed by the project administrator; retained here for future project setup:

```sh
gcloud projects add-iam-policy-binding morivo-mvp \
  --member=serviceAccount:service-1018467228668@gcp-sa-firebasestorage.iam.gserviceaccount.com \
  --role=roles/firebaserules.firestoreServiceAgent \
  --condition=None
```

This grants the existing Firebase Storage service agent the standard role needed to evaluate Firestore membership in Storage rules. It does not grant participants access to other families. Do not relax Storage or Firestore rules to work around the missing role.

The deployment identity `morivo-functions-deploy@morivo-mvp.iam.gserviceaccount.com` cannot change the project's IAM policy; the automated attempt failed with `morivo-mvp:setIamPolicy: Policy update access denied`. The deployment workflow intentionally does not keep retrying the unauthorized IAM operation.

Live verification: in “הרפתקה אתונאית: משפחות שדה וכהן כובשות את יוון” (ID 7u8pr4J7nXPiXsM3zEDF), the participant uploaded two illustrative photos and advanced to the next mission. The Sadeh family book displays both photos; the Cohen family book remains empty. The participant book also displays both photos.

Validation completed: production Next build; family composition, invitation and identity tests; Firestore/Storage emulator checks (scoped reads and queries, forged assignment denial, private invite/book access, owner roster queries, legacy compatibility); production creation of two families (6 adults, 5 children, 3 rooms), separate family links, member join and persistent individual progress, live uploads and family-book isolation.

The story generator now uses bounded Gemini attempts followed by OpenAI fallback. Provider success/fallback/failure, family-scoped queries, removed-photo exclusion, authorization and quotas pass mocked handler tests. Production verification is currently blocked by the demo anonymous account's daily story limit after earlier failed calls; do not claim a successful live story generation yet.

The next family update adds protected per-family puzzle images in familyBooks, a puzzle finale, organizer photo caption/replacement and recoverable removal, explicit title editing, pre-trip coordination polls outside journey progress and calendar-only date formatting. Production checks confirmed different puzzle images per family, title persistence, photo caption/removal/restore and an automatically opened poll whose selection persists.

Official guidance: https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service
