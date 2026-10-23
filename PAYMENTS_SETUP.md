# Payments — what's done and what you still need to do

Publishing a draft experience in Studio now requires payment first, priced per participant
(adults + children for a family trip, or the participant count for any other experience type).
The organizer pays once through a secure page Stripe hosts itself — nothing here ever touches a
card number — and the publish button unlocks automatically once the payment confirms.

This only covers the **website and Android app**. iOS was intentionally left out of this round —
Apple requires using its own In-App Purchase system (15–30% commission) for a digital
service like this one, which is a separate, bigger piece of work if you want it later.

## What's already built

- `functions/payments.js` — `createCheckoutSession` (starts a payment) and `stripeWebhook`
  (Stripe calls this itself once a payment completes, to mark the experience paid).
- Studio's publish button shows a "💳 Pay & publish" state until the experience is paid, then
  behaves exactly as before.
- Firestore rules were tightened so only Stripe's own webhook can ever mark an experience paid —
  not something an organizer could fake from their browser.
- The price is one constant, `PRICE_PER_PARTICIPANT` in `functions/payments.js` (currently a
  **placeholder: 20.00 ILS per participant**) — change that one number and push to update the
  price everywhere at once. No other file needs to change.

## What you need to do before this actually works

### 1. Create a Stripe account

Go to [stripe.com](https://stripe.com) and sign up. You'll land in **test mode** by default —
good, test it there first with Stripe's fake card numbers before ever taking a real payment.

### 2. Get your secret key

Stripe dashboard → Developers → API keys → copy the **Secret key** (starts with `sk_test_...` in
test mode, `sk_live_...` once you switch to live mode).

### 3. Store that key as a Firebase secret

This is the one step that needs a command run with your own Firebase login (I can't do this
part myself — it has to come from an account with access to your Firebase project). If that's
not you, ask whoever manages the Firebase project, or use the Google Cloud Console option below.

**Command line** (needs the Firebase CLI and to be logged into the `morivo-mvp` project):
```
firebase functions:secrets:set STRIPE_SECRET_KEY
```
It'll prompt you to paste the key — paste it and press enter.

**Or, no command line needed:** Google Cloud Console → your `morivo-mvp` project → Security →
Secret Manager → Create Secret → name it exactly `STRIPE_SECRET_KEY` → paste the key as the
value.

### 4. Register the webhook (after the next deploy)

Once this code is deployed, find the webhook's exact URL — it should be this (Firebase's standard
pattern for a function named `stripeWebhook` in this project), but confirm it in the
[Firebase console](https://console.firebase.google.com/project/morivo-mvp/functions) → Functions
→ `stripeWebhook` → copy its **Trigger URL**, since the exact format can vary:
```
https://us-central1-morivo-mvp.cloudfunctions.net/stripeWebhook
```
In Stripe dashboard → Developers → Webhooks → Add endpoint:
- **Endpoint URL**: the URL you copied
- **Events to send**: select `checkout.session.completed`

After creating it, Stripe shows a **Signing secret** (starts with `whsec_...`) — store that one
the same way as step 3, but as `STRIPE_WEBHOOK_SECRET` instead.

### 5. Test it

In Stripe's test mode, use card number `4242 4242 4242 4242`, any future expiry date, any CVC.
Create a draft experience, click "Pay & publish," pay with that test card, and confirm the
button unlocks and publishing goes through.

### 6. Go live

Stripe dashboard → toggle out of test mode → repeat steps 2–4 with your **live** keys (Stripe
keeps test and live keys/webhooks completely separate) — update the two secrets with the live
values, and register a second webhook endpoint (same URL) for live mode.

## Changing the price later

Edit `PRICE_PER_PARTICIPANT` in `functions/payments.js` (it's in agorot/cents — `2000` = 20.00),
push to `main`, and it deploys automatically.
