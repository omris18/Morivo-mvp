const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {randomUUID} = require("crypto");
const {OpenAI, toFile} = require("openai");
const {canManageExperience} = require("./masterAccess");
module.exports = function celebrationCartoon(admin, secret) {
  return onCall({secrets:[secret],cors:true,timeoutSeconds:180,memory:"512MiB",maxInstances:3}, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated","Sign in first.");
    const id = request.data?.experienceId;
    if (typeof id !== "string" || !id || id.includes("/")) throw new HttpsError("invalid-argument","Experience required.");
    const db = admin.firestore(), ref = db.collection("experiences").doc(id);
    const exp = (await ref.get()).data();
    if (!exp) throw new HttpsError("not-found","Experience not found.");
    if (!canManageExperience(request.auth,exp)) throw new HttpsError("permission-denied","Only the organizer or master can create the cartoon.");
    const portrait = exp.celebrationPortrait;
    if (!portrait?.storagePath) throw new HttpsError("failed-precondition","Upload the birthday child's photo first.");
    try {
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(portrait.storagePath).download();
      const client = new OpenAI({apiKey:secret.value().trim()});
      const file = await toFile(buffer,"portrait.png",{type:"image/png"});
      // A style transform, not a text-to-image guess: the model edits the organizer's own
      // uploaded photo, so the result stays recognizably that child rather than inventing one -
      // the opposite tradeoff from generateExperienceArtwork's generic scene illustrations.
      const prompt = "Turn this photo into a warm, joyful cartoon/caricature illustration for a birthday celebration poster background. Storybook style, soft rounded shapes, bright festive colors, a simple uncluttered background with a few balloons or confetti. Keep the same person recognizable but gently stylized, not photorealistic. No text, no logos, no watermark.";
      const result = await client.images.edit({model:"gpt-image-1",image:file,prompt,size:"1024x1024",n:1});
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("Empty image");
      const path = `experiences/${id}/artwork/cartoon-${randomUUID()}.png`, token = randomUUID();
      await bucket.file(path).save(Buffer.from(b64,"base64"),{contentType:"image/png",metadata:{cacheControl:"private,max-age=86400",metadata:{firebaseStorageDownloadTokens:token}}});
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
      const oldPath = portrait.cartoonStoragePath;
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.celebrationPortrait?.storagePath === portrait.storagePath) {
          tx.update(ref,{celebrationPortrait:{...current.celebrationPortrait,cartoonUrl:url,cartoonStoragePath:path}});
        }
      });
      if (oldPath) await bucket.file(oldPath).delete().catch(()=>{});
      return {url};
    } catch (err) {
      console.error("Celebration cartoon generation failed",err.message);
      throw new HttpsError("unavailable","Could not create the cartoon. Please retry.");
    }
  });
};
