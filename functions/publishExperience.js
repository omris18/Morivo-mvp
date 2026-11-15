const {normalizeFamilies,totals}=require("./families");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {randomBytes} = require("crypto");
const {canManageExperience, isMasterToken} = require("./masterAccess");
const {participantCountOf, PRICE_PER_PARTICIPANT, CURRENCY} = require("./payments");

// Publishing used to be two writes made straight from the browser, which meant "has this been
// paid for" could only ever be checked in the browser too - anyone could skip it. firestore.rules
// now refuses a client setting status "live", a join code or a publicExperiences entry, so this
// function is the only way an experience goes live and the payment check cannot be bypassed.
module.exports = (admin, {paymentsEnabled}) => onCall({cors: true, timeoutSeconds: 30}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const id = request.data?.experienceId;
  if (typeof id !== "string" || !id || id.includes("/")) throw new HttpsError("invalid-argument", "An experience is required.");
  const db = admin.firestore(), ref = db.collection("experiences").doc(id);
  return db.runTransaction(async tx => {
    const exp = (await tx.get(ref)).data();
    if (!exp) throw new HttpsError("not-found", "Experience not found.");
    if (!canManageExperience(request.auth, exp)) throw new HttpsError("permission-denied", "Only the organizer can publish this experience.");
    if (exp.wizardDraft || !Array.isArray(exp.flow) || !exp.flow.length) {
      throw new HttpsError("failed-precondition", "Add at least one mission before publishing.");
    }
    if (paymentsEnabled && !exp.paid && !isMasterToken(request.auth.token)) {
      const participants = participantCountOf(exp);
      return {paymentRequired: true, participants, amount: participants * PRICE_PER_PARTICIPANT, currency: CURRENCY};
    }
    let joinCode = String(exp.joinCode || ("M" + id.slice(-7))).toUpperCase();
    let publicRef = db.collection("publicExperiences").doc(joinCode);
    for (let attempt = 0; ; attempt++) {
      const existing = (await tx.get(publicRef)).data();
      if (!existing || existing.experienceId === id) break;
      if (attempt >= 5) throw new HttpsError("aborted", "Could not reserve a join code. Please try again.");
      joinCode = "M" + randomBytes(4).toString("hex").slice(0, 7).toUpperCase();
      publicRef = db.collection("publicExperiences").doc(joinCode);
    }
    let families;try{families=normalizeFamilies(exp.families)}catch(e){throw new HttpsError("invalid-argument",e.message)}
    const familyInvites=[];
    for(const family of families){
      const inviteRef=db.collection(`experiences/${id}/familyInvites`).doc(family.id);
      const old=(await tx.get(inviteRef)).data();
      familyInvites.push({family,inviteRef,code:old?.code||("F"+randomBytes(16).toString("hex").toUpperCase())});
    }
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();
    for(const {family,inviteRef,code} of familyInvites){
      const invite={experienceId:id,familyId:family.id,familyName:family.name,ownerUid:exp.ownerUid,code};
      tx.set(inviteRef,invite);tx.set(db.collection("familyCodes").doc(code),invite);
    }
    tx.update(ref, {status: "live", joinCode, updatedAt,...(families.length?{families,adultsCount:totals(families).adults,childrenCount:totals(families).children,people:totals(families).adults+totals(families).children}:{})});
    tx.set(publicRef, {experienceId: id, ownerUid: exp.ownerUid, name: exp.name || "", status: "live", joinCode, updatedAt});
    return {joinCode};
  });
});
