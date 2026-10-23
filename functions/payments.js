const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");

// The only numbers to change for a real price - see PAYMENTS_SETUP.md for how pricing fits
// together with the Stripe account itself. Stored in the smallest currency unit (agorot, same
// as cents) since that's what Stripe's API always expects, regardless of currency.
const PRICE_PER_PARTICIPANT = 2000; // placeholder: 20.00 ILS per participant
const CURRENCY = "ils";
const MIN_PARTICIPANTS = 1;

// Family trips store the headcount as adultsCount/childrenCount (see AICreator.js); every other
// experience type stores it as a single "people" number. Either way, never charge for zero
// participants - an experience always has at least the organizer.
function participantCountOf(exp) {
  const adults = Number(exp?.adultsCount);
  const children = Number(exp?.childrenCount);
  if (Number.isFinite(adults) || Number.isFinite(children)) {
    return Math.max(MIN_PARTICIPANTS, (Number.isFinite(adults) ? adults : 0) + (Number.isFinite(children) ? children : 0));
  }
  const people = Number(exp?.people);
  return Math.max(MIN_PARTICIPANTS, Number.isFinite(people) ? people : MIN_PARTICIPANTS);
}

// Stripe Checkout - a page Stripe hosts and secures itself, so this app never touches a card
// number. Works identically from the website and from the Android app (Capacitor opens it in
// the system browser) with no extra per-platform work; unlike iOS, Google Play doesn't require
// its own in-app billing for a plain web checkout like this one.
function createCheckoutSession(admin, stripeSecretKey) {
  return onCall({ secrets: [stripeSecretKey], cors: true, timeoutSeconds: 30 }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const { experienceId, successUrl, cancelUrl } = request.data || {};
    if (typeof experienceId !== "string" || !experienceId) {
      throw new HttpsError("invalid-argument", "An experience is required.");
    }
    if (typeof successUrl !== "string" || !successUrl || typeof cancelUrl !== "string" || !cancelUrl) {
      throw new HttpsError("invalid-argument", "Missing redirect URLs.");
    }

    const db = admin.firestore();
    const ref = db.collection("experiences").doc(experienceId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Experience not found.");
    const exp = snap.data();
    if (exp.ownerUid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the organizer can pay for this experience.");
    }
    if (exp.paid) return { alreadyPaid: true };

    const participants = participantCountOf(exp);

    const Stripe = require("stripe");
    const stripe = Stripe(stripeSecretKey.value().trim());
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: CURRENCY,
            unit_amount: PRICE_PER_PARTICIPANT,
            product_data: { name: `Morivo${exp.name ? ` - ${exp.name}` : ""} (${participants} ${participants === 1 ? "participant" : "participants"})` },
          },
          quantity: participants,
        }],
        // Both set - metadata is what the webhook actually reads, client_reference_id is a
        // second, independent place Stripe's own dashboard surfaces it for a human looking up a
        // specific payment later.
        client_reference_id: experienceId,
        metadata: { experienceId },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
    } catch (err) {
      console.error("Stripe checkout session creation failed", err);
      throw new HttpsError("unavailable", `Payment setup failed (${String(err.message || err).slice(0, 200)}). Please try again.`);
    }
    return { url: session.url };
  });
}

// Stripe calls this directly (never the browser) once a payment actually completes - signature
// verification is the only thing standing between this endpoint and anyone claiming any
// experience is paid for free, so it must run on the UNPARSED request body (req.rawBody, which
// Firebase Functions v2 provides automatically) rather than Express's usual parsed req.body.
function stripeWebhook(admin, stripeSecretKey, stripeWebhookSecret) {
  return onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
    const Stripe = require("stripe");
    const stripe = Stripe(stripeSecretKey.value().trim());
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], stripeWebhookSecret.value().trim());
    } catch (err) {
      console.error("Stripe webhook signature verification failed", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const experienceId = session.metadata?.experienceId || session.client_reference_id;
      if (experienceId) {
        await admin.firestore().collection("experiences").doc(experienceId).set({
          paid: true,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAmount: session.amount_total,
          paymentSessionId: session.id,
        }, { merge: true });
      } else {
        console.error("Stripe checkout.session.completed with no experienceId in metadata", session.id);
      }
    }

    res.json({ received: true });
  });
}

module.exports = { createCheckoutSession, stripeWebhook, participantCountOf, PRICE_PER_PARTICIPANT, CURRENCY };
