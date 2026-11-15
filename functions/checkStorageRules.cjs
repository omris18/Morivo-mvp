// Read-only deployment diagnostics. Never print authentication tokens or user documents.
const {GoogleAuth}=require('google-auth-library');
(async()=>{
 const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
 const client=await auth.getClient();
 const bucket=await client.request({url:'https://firebasestorage.googleapis.com/v1alpha/projects/morivo-mvp/defaultBucket'});
 console.log('Default Storage bucket:',bucket.data.bucket?.name);
 const releases=await client.request({url:'https://firebaserules.googleapis.com/v1/projects/morivo-mvp/releases'});
 for(const r of releases.data.releases||[]){
  if(!r.name.includes('firebase.storage'))continue;
  const rules=await client.request({url:'https://firebaserules.googleapis.com/v1/'+r.rulesetName});
  console.log('Storage release:',r.name,'updated:',r.updateTime,'has family path:',rules.data.source?.files?.some(f=>f.content.includes('/families/{familyId}/media/')));
 }
})().catch(e=>{console.error('Storage diagnostic:',e.message);process.exitCode=1});
