# Master administration and dashboard refinement

The platform master is the Firebase-authenticated, **verified** email
`omris18@gmail.com` (case-insensitive). The identity comes from Firebase's signed
token. Profile fields, local storage, request data and arbitrary custom claims do
not grant this role. An email/password account with an unverified address is not
a master; Google sign-in with the verified address is supported.

`functions/masterAccess.js` is shared by the client capability indicator and
server callables. The equivalent checks in `firestore.rules` and `storage.rules`
must stay aligned. Deployment must include the access rules as well as functions.
No service-account key or browser credential is embedded in the application.

Master access covers experience administration, mission ordering, live controls,
participant progress, artwork and memory-book management. Editing preserves the
original `ownerUid`; opening an experience as master does not claim ownership.
The master console listens to all experiences only while that view is open.
Ordinary dashboards still query only their owner's experiences. Auth changes
clear the active experience and privileged screen to prevent stale display.

## Parallel development boundaries

- New console: `components/MasterDashboard.js`, `lib/masterData.js`.
- New card image component: `components/ExperienceCover.js`.
- Visual refinement: `app/morivo-refinement.css`, scoped to dashboard/master.
- AI generation UI, the AI-first hero copy and organizer-decided branches retain
  the existing implementation. No replacement global stylesheet is introduced.
- Read current main before merging concurrent work; preserve the master props in
  `app/page.js`, `Runtime`, `Memory`, `Account` and `Sidebar`.

Tests: `node tests/masterAccess.test.cjs`,
`node tests/reorderExperience.test.cjs`,
`node tests/experienceArtwork.test.cjs`, and `npm run build`.
`tests/masterRules.test.cjs` exercises the actual Firestore rules in the emulator
on port 8188, using project `demo-morivo-master` and the Firebase rules test SDK.
It verifies cross-owner master access, rejects unverified identities and profile
spoofing, and ensures ownership cannot be silently transferred.

Do not add a production impersonation or role-preview switch for UI testing.
