# Morivo MVP

## Version number

`package.json`'s `version` field is shown to the organizer in the app itself, next to the
Firebase connection indicator (`components/FirebaseStatus.js`), specifically so she can confirm
after a push that she's actually looking at the latest deploy (and so this is visible to future
users after version updates too).

**Bump the patch version (e.g. `1.0.3` → `1.0.4`) in every commit that changes app behavior** -
a bug fix, a new feature, a UI change. Bump the minor version instead for a larger feature. Skip
the bump only for changes with no user-visible effect at all (a comment, a test, CI config, this
file). Bump it in the same commit as the change, not a separate one.

## Deploying

The Firebase Functions deploy workflow (`.github/workflows/deploy-firebase-functions.yml`) runs
`firebase deploy --only functions` - the whole codebase, not a hand-maintained list of function
names. Keep it that way: an earlier explicit `--only functions:<name>,<name>,...` allow-list
silently never deployed a function that was missing from it (`proposeItinerary`, for months),
and every fix pushed to that function kept reporting CI success while changing nothing in
production. Never reintroduce a per-function allow-list here.

The frontend (Next.js static export) deploys to Vercel on push to `main`, separately from the
Functions workflow above - a frontend-only change (no `functions/**` touched) won't trigger a
GitHub Actions run at all, which is expected.
