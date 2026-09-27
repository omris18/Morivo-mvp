const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {randomUUID} = require("crypto");
const {OpenAI, toFile} = require("openai");
const {canManageExperience} = require("./masterAccess");
module.exports = function familyPuzzleCartoon(admin, secret) {
  return onCall({secrets:[secret],cors:true,timeoutSeconds:180,memory:"512MiB",maxInstances:3}, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated","Sign in first.");
    const id = request.data?.experienceId;
    if (typeof id !== "string" || !id || id.includes("/")) throw new HttpsError("invalid-argument","Experience required.");
    const db = admin.firestore(), ref = db.collection("experiences").doc(id);
    const exp = (await ref.get()).data();
    if (!exp) throw new HttpsError("not-found","Experience not found.");
    if (!canManageExperience(request.auth,exp)) throw new HttpsError("permission-denied","Only the organizer or master can create the cartoon.");
    const photo = exp.familyPuzzle;
    if (!photo?.storagePath) throw new HttpsError("failed-precondition","Upload the family photo first.");
    try {
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(photo.storagePath).download();
      const client = new OpenAI({apiKey:secret.value().trim()});
      const file = await toFile(buffer,"family.png",{type:"image/png"});
      // A style transform of the organizer's own photo (like celebrationCartoon), tuned for a
      // wide group scene rather than a single birthday portrait: this becomes a puzzle image
      // sliced entirely with CSS background-position, so the source just needs to fill 1024x1024.
      const prompt = "Turn this family or group photo into a warm, joyful cartoon illustration for a keepsake puzzle. Storybook style, soft rounded shapes, bright cheerful colors, a simple uncluttered background. Keep everyone recognizable but gently stylized, not photorealistic. No text, no logos, no watermark.";
      const result = await client.images.edit({model:"gpt-image-1",image:file,prompt,size:"1024x1024",n:1});
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("Empty image");
      const path = `experiences/${id}/artwork/puzzle-${randomUUID()}.png`, token = randomUUID();
      await bucket.file(path).save(Buffer.from(b64,"base64"),{contentType:"image/png",metadata:{cacheControl:"private,max-age=86400",metadata:{firebaseStorageDownloadTokens:token}}});
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
      const oldPath = photo.cartoonStoragePath;
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.familyPuzzle?.storagePath === photo.storagePath) {
          tx.update(ref,{familyPuzzle:{...current.familyPuzzle,cartoonUrl:url,cartoonStoragePath:path}});
        }
      });
      if (oldPath) await bucket.file(oldPath).delete().catch(()=>{});
      return {url};
    } catch (err) {
      console.error("Family puzzle cartoon generation failed",err.message);
      throw new HttpsError("unavailable","Could not create the cartoon. Please retry.");
    }
  });
};
