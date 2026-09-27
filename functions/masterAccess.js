// Never trust a profile document or request body for platform privileges.
// Firebase supplies these claims in the verified authentication token.
const MASTER_EMAIL = 'omris18@gmail.com';
function isMasterToken(token) {
  return token?.email_verified === true && typeof token.email === 'string'
    && token.email.toLowerCase() === MASTER_EMAIL;
}
function canManageExperience(auth, experience) {
  return !!auth?.uid && (experience?.ownerUid === auth.uid || isMasterToken(auth.token));
}
module.exports = {MASTER_EMAIL, isMasterToken, canManageExperience};
