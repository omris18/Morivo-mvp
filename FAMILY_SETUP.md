# Family memory books: production prerequisite

The family feature is deployed. Family invitations, participant identities and Firestore isolation have been validated. Production Storage uploads currently fail because the Firebase Storage service agent cannot read Firestore membership records. Firebase CLI 14 skips cross-service IAM setup in non-interactive mode.

A project administrator must run this once in Google Cloud Shell:

```sh
gcloud projects add-iam-policy-binding morivo-mvp \
  --member=serviceAccount:service-1018467228668@gcp-sa-firebasestorage.iam.gserviceaccount.com \
  --role=roles/firebaserules.firestoreServiceAgent \
  --condition=None
```

This grants the existing Firebase Storage service agent the standard role needed to evaluate Firestore membership in Storage rules. It does not grant participants access to other families. Do not relax Storage or Firestore rules to work around the missing role.

The deployment identity `morivo-functions-deploy@morivo-mvp.iam.gserviceaccount.com` cannot change the project's IAM policy; the automated attempt failed with `morivo-mvp:setIamPolicy: Policy update access denied`. The deployment workflow intentionally does not keep retrying the unauthorized IAM operation.

After the role propagates, retry the family photo upload, reload the family book, and verify that the other family's book remains empty. The live test experience is “הרפתקה אתונאית: משפחות שדה וכהן כובשות את יוון” (ID 7u8pr4J7nXPiXsM3zEDF). Two illustrative photos are selected in the participant test browser but have NOT uploaded successfully.

Validation already completed: production Next build; family composition, invitation and identity tests; Firestore/Storage emulator checks (scoped reads and queries, forged assignment denial, private invite/book access, owner roster queries, legacy compatibility); production creation of two families (6 adults, 5 children, 3 rooms), separate family links, member join and persistent individual progress. Live uploads and populated-family-book verification remain pending the administrator step.

Official guidance: https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service
