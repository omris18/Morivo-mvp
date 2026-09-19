# Morivo — Android & iOS app setup (Capacitor)

Morivo is wrapped for the app stores with [Capacitor](https://capacitorjs.com):
the existing Next.js app builds to static files (`next build`, with
`output: "export"` in `next.config.js`) and Capacitor loads that static
build inside a native shell for Android and iOS. No rewrite — the web app
is the app.

## Every time you change app code

```
npm run cap:sync
```

This runs `next build` and copies the fresh static output into both
`android/` and `ios/`. Run it before opening either native project.

## Android — get an installable APK without installing anything

`.github/workflows/android-build.yml` builds a debug APK automatically
on every push to `main` or a `claude/**` branch (also runnable on demand
from the GitHub Actions tab → "Android debug build" → Run workflow).

1. Push (or open the Actions tab in GitHub for this repo).
2. Wait for the "Android debug build" run to finish (a few minutes).
3. Open that run → **Artifacts** → download `morivo-debug-apk`, unzip it
   to get `app-debug.apk`.
4. Send that file to an Android phone (email, Drive, USB, whatever) and
   open it there. Android will ask to allow installing from this source
   the first time — allow it, then install.

This is a real installed app icon/window, not a browser tab — exactly
what you need to check resolution, touch targets, and how buttons feel
on an actual device. It's unsigned/debug, which is fine for this kind
of testing; a signed release build is a separate step, only needed right
before a real Play Store submission (see below).

By default this debug build runs in demo mode (no live Firebase data),
same as running `npm run dev` locally without `.env.local`. To make it
build against the real `morivo-mvp` Firebase project instead, add these
as **Actions secrets** (GitHub repo → Settings → Secrets and variables →
Actions → New repository secret), one secret per line from your
`NEXT_PUBLIC_FIREBASE_*` values — the workflow already reads them if
present:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## Android — full local setup (only needed for a real signed release)

1. Install [Android Studio](https://developer.android.com/studio).
2. `npx cap open android` — opens `android/` in Android Studio.
3. Let Gradle sync, then Run on a device/emulator to test.
4. Replace the placeholder launcher icons in
   `android/app/src/main/res/mipmap-*` with real Morivo branding
   (Android Studio's Image Asset tool does this for you from a single
   source image).
5. For a Play Store build: Android Studio → Build → Generate Signed App
   Bundle, with your own keystore (back it up — losing it means you can
   never update the app again under the same listing).
6. You'll need a Google Play Console developer account (one-time fee)
   to publish.

## iOS

**Requires a Mac with Xcode** — this cannot be built or tested on Linux.
The `ios/` folder is already scaffolded and ready to open there.

1. On a Mac: `npx cap open ios` — opens `ios/App/App.xcodeproj` in Xcode.
2. Set your Team under Signing & Capabilities (needs an Apple Developer
   Program membership, paid annually, to run on a real device or submit).
3. Replace the placeholder app icon set in
   `ios/App/App/Assets.xcassets/AppIcon.appiconset` with real branding.
4. Run on a simulator or device to test.
5. Product → Archive, then distribute via App Store Connect to submit.

If you don't own a Mac, a cloud CI runner with macOS (GitHub Actions
macOS runners, Codemagic, Bitrise) can build and even submit the iOS app
without you owning Apple hardware.

## Already handled in the web app for store-readiness

- `next.config.js` uses `output: "export"` — a fully static build, which
  is what Capacitor needs.
- `app/layout.js` sets safe-area/viewport metadata
  (`viewport-fit=cover`, `theme-color`, Apple web-app meta) so content
  doesn't sit under notches/status bars.
- `app/globals.css` disables overscroll bounce and the tap-highlight
  flash, and adds `safe-area-inset-*` padding, so it feels native rather
  than like a website in a frame.
- iOS `Info.plist` already declares camera/photo-library usage strings
  (`NSCameraUsageDescription` etc.) — without these, iOS kills the app
  the moment a photo mission tries to open the camera/photo picker.

## Still outstanding before a real store submission

- **Real app icon and splash screen** — currently Capacitor's default
  placeholder graphics. Needs your actual Morivo branding.
- **Bundle identifier** — currently `com.morivo.app` in
  `capacitor.config.json` (and mirrored into both native projects at
  `cap add` time). Change it before your first store submission if you
  want something else; it's essentially impossible to change after
  you've published under an id.
- **Privacy Policy URL** — both stores require one before you can
  publish, since Morivo collects names, photos and location-adjacent
  activity data.
- **Push notifications, deep links (join codes), native Camera plugin**
  — not wired up yet; today the app uses a plain HTML file input for
  photo capture, which works fine inside the Capacitor WebView but is
  a candidate to upgrade later for a more native capture experience.
