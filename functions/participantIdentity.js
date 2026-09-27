const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { randomBytes } = require('node:crypto');
const { canManageExperience } = require('./masterAccess');
const normalizeName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 80);
const cleanCode = value => String(value || '').trim().toUpperCase();

// A personal code is a bearer invitation to ONE participant in ONE experience.
// Session aliases never grant the participant's Firebase account or organizer rights.
function handler(admin) {
  const db = admin.firestore();
  return async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
    const input = request.data || {}, action = input.action || 'join';
    if (!['join', 'personal', 'create'].includes(action)) throw new HttpsError('invalid-argument', 'Invalid action.');
    const code = cleanCode(input.code), name = normalizeName(input.name);
    if (action !== 'create' && !/^[A-Z0-9_-]{4,64}$/.test(code)) throw new HttpsError('invalid-argument', 'Invalid code.');
    const freshCode = randomBytes(16).toString('hex').toUpperCase();
    return db.runTransaction(async tx => {
      let eid = input.experienceId, invitation = null;
      if (action !== 'create') {
        const snap = await tx.get(db.doc(`${action === 'personal' ? 'participantCodes' : 'publicExperiences'}/${code}`));
        if (!snap.exists) throw new HttpsError('not-found', 'הקישור אינו תקף. בקשו קישור חדש מהמארגן.');
        invitation = { code, ...snap.data() }; eid = invitation.experienceId;
      }
      if (typeof eid !== 'string' || !eid || eid.includes('/')) throw new HttpsError('invalid-argument', 'Invalid experience.');
      const expRef = db.doc(`experiences/${eid}`), expSnap = await tx.get(expRef);
      if (!expSnap.exists) throw new HttpsError('not-found', 'Experience not found.');
      const exp = expSnap.data(), base = `experiences/${eid}`;
      if (action === 'create' && !canManageExperience(request.auth, exp)) throw new HttpsError('permission-denied', 'Only the organizer can create invitations.');
      if (action !== 'create' && exp.status !== 'live') throw new HttpsError('failed-precondition', 'החוויה עדיין לא פורסמה.');
      const sessionRef = db.doc(`${base}/participantSessions/${request.auth.uid}`);
      const session = await tx.get(sessionRef);
      const roster = await tx.get(db.collection('participantCodes').where('experienceId', '==', eid));
      const codes = roster.docs.map(d => ({ code: d.id, ...d.data() }));
      let pid = action === 'personal' ? invitation.participantId : action === 'create' ? input.participantId : session.data()?.participantId;
      if (pid && (typeof pid !== 'string' || pid.includes('/'))) throw new HttpsError('invalid-argument', 'Invalid participant.');
      let person = pid ? await tx.get(db.doc(`${base}/participants/${pid}`)) : null;
      if (action === 'join' && !person?.exists) {
        // Adopt an older record from this authenticated device, without resetting it.
        const legacy = await tx.get(db.doc(`${base}/participants/${request.auth.uid}`));
        if (legacy.exists) { pid = legacy.id; person = legacy; }
      }
      if (action === 'create' && input.participantId && !person?.exists) throw new HttpsError('not-found', 'Participant not found.');
      let selected = action === 'personal' ? invitation : person?.exists ? codes.find(c => c.participantId === pid) : null;
      if (!selected) {
        const wantedName = person?.exists ? normalizeName(person.data().name) : action === 'personal' ? normalizeName(invitation.name) : name;
        if (!wantedName) return { needsName: true };
        const matches = codes.filter(c => normalizeName(c.name) === wantedName && ((action === 'create' && !person?.exists) || !c.participantId));
        if (matches.length > 1) throw new HttpsError('failed-precondition', 'יש כמה הזמנות בשם הזה. השתמשו בקישור האישי מהמארגן.');
        selected = matches[0] || null;
      }
      if (action === 'create' && selected && (!person?.exists || selected.participantId === pid)) return { code: selected.code };
      if (action === 'create' && !name && !person?.exists) throw new HttpsError('invalid-argument', 'Enter a name.');
      // Legacy invitations did not have an ID. Match once only, never by name after binding.
      if (action === 'personal' && !pid) {
        const matches = await tx.get(db.collection(`${base}/participants`).where('name', '==', invitation.name));
        const eligible = matches.docs.filter(d => !codes.some(c => c.participantId === d.id && c.code !== code));
        if (eligible.length > 1) throw new HttpsError('failed-precondition', 'יש כמה משתתפים בשם הזה. בקשו מהמארגן קישור מתוך רשומת המשתתף.');
        if (eligible.length === 1) { person = eligible[0]; pid = person.id; }
      }
      const personalCode = selected?.code || freshCode;
      const resolvedName = person?.exists ? person.data().name : selected?.name || name;
      if (action === 'create' && !person?.exists) {
        tx.create(db.doc(`participantCodes/${personalCode}`), { experienceId: eid, ownerUid: exp.ownerUid, name: resolvedName, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        return { code: personalCode };
      }
      pid = person?.exists ? person.id : selected?.participantId || db.collection(`${base}/participants`).doc().id;
      const now = admin.firestore.FieldValue.serverTimestamp();
      const codeRef = db.doc(`participantCodes/${personalCode}`);
      const binding = { experienceId: eid, ownerUid: exp.ownerUid, name: resolvedName, participantId: pid };
      if (selected) tx.set(codeRef, binding, { merge: true });
      else tx.create(codeRef, { ...binding, createdAt: now });
      const personRef = db.doc(`${base}/participants/${pid}`);
      if (!person?.exists) {
        tx.create(personRef, { uid: pid, name: resolvedName, team: 'Participants', points: 0, missions: 0, joinedAt: now });
        tx.create(db.collection(`${base}/events`).doc(), { type: 'join', uid: pid, text: `👋 ${resolvedName} joined the experience`, createdAt: now });
      }
      if (action !== 'create') tx.set(sessionRef, { participantId: pid, updatedAt: now });
      return { experienceId: eid, uid: pid, name: resolvedName, personalCode, joinCode: exp.joinCode || '', code: personalCode };
    });
  };
}
module.exports = admin => onCall({ maxInstances: 10 }, handler(admin));
module.exports.handler = handler;
module.exports.normalizeName = normalizeName;
