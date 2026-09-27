const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {reorderProgress}=require('./journeyProgress');
module.exports=admin=>onCall({cors:true,timeoutSeconds:60},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');
 const {experienceId,order,expectedOrder}=request.data||{};
 if(typeof experienceId!=='string'||!experienceId||experienceId.includes('/')||!Array.isArray(order)||!Array.isArray(expectedOrder))throw new HttpsError('invalid-argument','Experience and mission order are required.');
 const db=admin.firestore(),ref=db.collection('experiences').doc(experienceId);
 return db.runTransaction(async tx=>{
  const exp=(await tx.get(ref)).data();
  if(!exp)throw new HttpsError('not-found','Experience not found.');
  if(exp.ownerUid!==request.auth.uid)throw new HttpsError('permission-denied','Only the organizer can reorder missions.');
  const flow=exp.flow||[],ids=flow.map(m=>m.id);
  if(JSON.stringify(ids)!==JSON.stringify(expectedOrder))throw new HttpsError('aborted','המסלול השתנה בינתיים. רעננו ונסו שוב.');
  if(order.length!==ids.length||new Set(order).size!==ids.length||order.some(id=>!ids.includes(id)))throw new HttpsError('invalid-argument','The new order must contain each existing mission exactly once.');
  if(JSON.stringify(ids)===JSON.stringify(order))return {order};
  const rows=await tx.get(ref.collection('progress'));
  if(rows.size>450)throw new HttpsError('failed-precondition','שינוי סדר במסע עם יותר מ־450 משתתפים פעילים אינו נתמך כרגע.');
  const byId=new Map(flow.map(m=>[m.id,m])),newFlow=order.map(id=>byId.get(id));
  for(const row of rows.docs)tx.set(row.ref,{...reorderProgress(row.data(),flow,newFlow),routeReorderedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  tx.update(ref,{flow:newFlow,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  return {order};
 });
});
