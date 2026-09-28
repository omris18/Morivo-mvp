"use client";
import PhotoJourney from "./PhotoJourney";
import CelebrationPhotoPicker from "./CelebrationPhotoPicker";
import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {firebaseConfigured,functions} from "../lib/firebase";
import {createExperienceRemote,ensureUser,subscribeSiteAsset,generateBrandImageRemote} from "../lib/morivoData";

const TYPE_OPTIONS={
 en:["Family Trip","Family Day Trip","Birthday","Team Building","School","Museum"],
 he:["טיול משפחתי","טיול משפחתי חד יומי","יום הולדת","גיבוש צוות","בית ספר","מוזיאון"]
};
const DURATION_OPTIONS={
 en:["30 minutes","1 hour","2-3 hours","Half day (4-5 hours)","Full day"],
 he:["30 דקות","שעה","2-3 שעות","חצי יום (4-5 שעות)","יום שלם"]
};

function daysBetween(start,end){
 if(!start||!end)return 0;
 const diff=Math.round((new Date(end+"T00:00:00")-new Date(start+"T00:00:00"))/86400000)+1;
 return diff>0?diff:0;
}
function generateDraft(f){
 const subject=f.prompt.trim()||"your experience";
 const loc=f.location.trim();
 return [
  {id:"story-"+Date.now(),type:"story",title:"The Beginning",text:`Open ${subject}${loc?` in ${loc}`:""} with a personal moment that brings everyone into the story.`,reward:"First chapter unlocked",points:50},
  {id:"photo-"+(Date.now()+1),type:"photo",title:"Capture the Moment",text:"Take one photo that could only belong to this group and this experience.",reward:"Memory captured",points:100},
  {id:"map-"+(Date.now()+2),type:"map",title:"Find the Next Chapter",text:`Reach a meaningful checkpoint${loc?` in ${loc}`:""} and discover what comes next.`,reward:"Route unlocked",points:120},
  {id:"quiz-"+(Date.now()+3),type:"quiz",title:"How Well Do You Know Each Other?",text:"Answer a playful question about the people sharing this experience.",reward:"Team bonus",points:100},
  {id:"puzzle-"+(Date.now()+4),type:"puzzle",title:"Piece of the Story",text:"Complete the challenge to reveal another piece of your shared story.",reward:"Puzzle piece",points:150},
  {id:"photo-"+(Date.now()+5),type:"photo",title:"The Unexpected One",text:"Capture something surprising, funny or beautiful that nobody planned.",reward:"Hidden memory",points:120},
  {id:"story-"+(Date.now()+6),type:"story",title:"One Thing to Remember",text:"Choose the moment from this experience you never want to forget.",reward:"Memory Book chapter",points:160}
 ];
}

export default function AICreator({setExperience,setView,setActiveId,user,lang,t,dir}){
 const a=t.aiCreator;
 const [portraitFile,setPortraitFile]=useState(null);
 const [form,setForm]=useState({prompt:"",type:"",location:"",duration:"",startDate:"",endDate:"",people:"",peopleDetails:"",hotelBooked:false,interests:[],adults:"2",children:"0",childrenAges:[],destinations:[]}),[building,setBuilding]=useState(false),[step,setStep]=useState(0);
 const [destinationInput,setDestinationInput]=useState("");
 const TOTAL_STEPS=3;
 const [formStep,setFormStep]=useState(1);
 const [stepError,setStepError]=useState("");
 const stepTitles=lang==="he"?["מה החוויה שלכם?","מתי ומי מגיעים?","מה יהפוך אותה למיוחדת?"]:["What's the experience?","When, and who's coming?","What makes it special?"];
 useEffect(()=>{if(formStep>1){const el=document.getElementById("ai-step-heading");el?.scrollIntoView({behavior:"smooth",block:"start"});el?.focus({preventScroll:true})}},[formStep]);
 const [phase,setPhase]=useState("form");
 const [itinerary,setItinerary]=useState(null);
 const [planError,setPlanError]=useState(null);
 const [selectedAttractionIds,setSelectedAttractionIds]=useState(new Set());
 const [selectedHotelIndex,setSelectedHotelIndex]=useState(-1);
 const [selectedHotelByDestination,setSelectedHotelByDestination]=useState({});
 function addDestination(){
  const v=destinationInput.trim();
  if(!v||form.destinations.includes(v))return;
  const destinations=[...form.destinations,v];
  setForm(f=>({...f,destinations,location:destinations.join(", ")}));
  setDestinationInput("");
 }
 function removeDestination(name){
  setForm(f=>{
   const destinations=f.destinations.filter(d=>d!==name);
   return {...f,destinations,location:destinations.join(", ")};
  });
 }
 function goNext(){
  if(formStep===1&&!form.prompt.trim()){setStepError(a.describeFirst);document.querySelector('.aiPrompt')?.focus();return}
  if(formStep===1&&isMultiDayFamilyTrip&&!form.destinations.length){setStepError(a.addDestinationFirst);document.querySelector('.destinationInputRow input')?.focus();return}
  setStepError("");
  setFormStep(s=>Math.min(TOTAL_STEPS,s+1));
 }
 function goBack(){setStepError("");setFormStep(s=>Math.max(1,s-1))}
 const isMultiDayFamilyTrip=form.type===TYPE_OPTIONS.en[0]||form.type===TYPE_OPTIONS.he[0];
 const isSingleDayFamilyTrip=form.type===TYPE_OPTIONS.en[1]||form.type===TYPE_OPTIONS.he[1];
 const isFamilyTrip=isMultiDayFamilyTrip||isSingleDayFamilyTrip;
 const tripDays=isMultiDayFamilyTrip?daysBetween(form.startDate,form.endDate):0;
 const [heroArt,setHeroArt]=useState(null),[loadingArt,setLoadingArt]=useState(null),[generatingKey,setGeneratingKey]=useState(null);
 const [customHeroArt,setCustomHeroArt]=useState(null),[customLoadingArt,setCustomLoadingArt]=useState(null);
 useEffect(()=>{const a=subscribeSiteAsset("aiCreatorHero",setHeroArt),b=subscribeSiteAsset("bookBuildingHero",setLoadingArt);return()=>{a();b()}},[]);
 const canGenerateArt=!!(form.prompt.trim()&&form.type);
 const artContext=[form.type,form.location.trim(),form.prompt.trim()].filter(Boolean).join(" — ");
 async function generateArt(key,setCustom){
  if(!canGenerateArt)return;
  setGeneratingKey(key);
  try{const url=await generateBrandImageRemote(key,artContext);if(url)setCustom(url)}catch(e){alert(e.message)}finally{setGeneratingKey(null)}
 }
 const shownHeroArt=customHeroArt,shownLoadingArt=customLoadingArt;
 function setChildrenCount(value){
  const count=Math.max(0,Math.min(8,Number(value)||0));
  setForm(f=>({...f,children:String(count),childrenAges:Array.from({length:count},(_,i)=>f.childrenAges[i]??"")}));
 }
 function setChildAge(index,value){setForm(f=>({...f,childrenAges:f.childrenAges.map((x,i)=>i===index?value:x)}))}
 function toggleInterest(key){
  setForm(f=>({...f,interests:f.interests.includes(key)?f.interests.filter(x=>x!==key):[...f.interests,key]}));
 }
 useEffect(()=>{if(!building)return;const id=setInterval(()=>setStep(x=>Math.min(x+1,a.thinking.length-1)),900);return()=>clearInterval(id)},[building,lang]);
 function baseFields(){
  const needsHotel=isMultiDayFamilyTrip&&!form.hotelBooked;
  return {prompt:form.prompt,type:form.type,location:form.location,duration:isMultiDayFamilyTrip?(tripDays?`${tripDays} days`:""):form.duration,startDate:isMultiDayFamilyTrip?form.startDate:null,endDate:isMultiDayFamilyTrip?form.endDate:null,people:isFamilyTrip?String(Number(form.adults||0)+Number(form.children||0)):form.people,peopleDetails:form.peopleDetails,adults:isFamilyTrip?Number(form.adults||0):null,children:isFamilyTrip?Number(form.children||0):null,childrenAges:isFamilyTrip?form.childrenAges.map(Number).filter(Number.isFinite):[],lang,multiDay:isMultiDayFamilyTrip,needsHotel,interests:isFamilyTrip?form.interests:[],destinations:isMultiDayFamilyTrip?form.destinations:[]};
 }
 async function goPlan(){
  if(!form.prompt.trim())return alert(a.describeFirst);
  if(isMultiDayFamilyTrip&&!form.destinations.length)return alert(a.addDestinationFirst);
  if(!firebaseConfigured)return alert(a.needsFirebase);
  setPhase("planning");setPlanError(null);
  try{
   await ensureUser();
   const propose=httpsCallable(functions,"proposeItinerary",{timeout:120000});
   const result=await propose(baseFields());
   setItinerary(result.data);
   setSelectedAttractionIds(new Set((result.data.attractions||[]).map((_,i)=>i)));
   setSelectedHotelIndex((result.data.hotels||[]).length?0:-1);
   setSelectedHotelByDestination(Object.fromEntries((result.data.hotelsByDestination||[]).map((d)=>[d.destination,d.options?.length?0:-1])));
   setPhase("review");
  }catch(e){
   console.error("Itinerary planning failed",e);
   setPlanError(`${e.code||"error"}: ${e.message||e}`);
   setPhase("form");
  }
 }
 function updatePlanStep(stepNum,values){
  setItinerary(it=>({...it,plan:it.plan.map(p=>p.step===stepNum?{...p,...values}:p)}));
 }
 function toggleAttraction(i){
  setSelectedAttractionIds(prev=>{const next=new Set(prev);next.has(i)?next.delete(i):next.add(i);return next});
 }
 function setDestinationHotelIndex(destination,idx){
  setSelectedHotelByDestination(prev=>({...prev,[destination]:idx}));
 }
 async function build(){
  const hasDestinations=(itinerary?.hotelsByDestination||[]).length>0;
  const approvedItinerary=itinerary?{
   name:itinerary.name,
   plan:itinerary.plan,
   selectedAttractions:(itinerary.attractions||[]).filter((_,i)=>selectedAttractionIds.has(i)),
   ...(hasDestinations?{
    selectedHotels:itinerary.hotelsByDestination.map(d=>{
     const idx=selectedHotelByDestination[d.destination];
     return {destination:d.destination,hotel:idx===-2?{poll:true,candidates:d.options||[]}:idx>=0?{...(d.options||[])[idx],candidates:d.options||[]}:null};
    }),
   }:{
    selectedHotel:selectedHotelIndex===-2?{poll:true,candidates:itinerary.hotels||[]}:selectedHotelIndex>=0?{...(itinerary.hotels||[])[selectedHotelIndex],candidates:itinerary.hotels||[]}:null,
   }),
  }:null;
  setPhase("building");setBuilding(true);setStep(0);
  const minWait=new Promise(r=>setTimeout(r,Math.max(4200,a.thinking.length*700)));
  let flow,name,usedAI=false,aiError=null;
  try{
   await ensureUser();
   const generate=httpsCallable(functions,"generateExperience",{timeout:120000});
   const result=await generate({...baseFields(),approvedItinerary});
   flow=result.data.flow;name=result.data.name;usedAI=true;
  }catch(e){
   console.error("AI generation failed, falling back to the draft generator",e);
   aiError=`${e.code||"error"}: ${e.message||e}`;
  }
  if(!flow){
   flow=generateDraft(form);
   name=form.prompt.trim().split(/[.!?\n]/)[0].slice(0,48)||"New Experience";
  }
  await minWait;
  const data={name,type:form.type,location:form.location,people:isFamilyTrip?Number(form.adults||0)+Number(form.children||0):Number(form.people||0),story:form.prompt,flow,status:"draft",aiGenerated:usedAI,lang,...(isFamilyTrip?{adultsCount:Number(form.adults||0),childrenCount:Number(form.children||0),childrenAges:form.childrenAges.map(Number)}:{}),...(isFamilyTrip&&form.startDate?{startDate:form.startDate}:{}),...(isFamilyTrip&&form.endDate?{endDate:form.endDate}:{})};
  try{
   const u=user||await ensureUser(),id=await createExperienceRemote(u.uid,data,/birthday|יום הולדת/i.test(form.type)?portraitFile:null);
   setExperience({...data,id,ownerUid:u.uid});setActiveId(id);
   setView("studio");
   if(aiError)alert(a.aiFailedNote+aiError);
  }catch(e){alert(e.message);setBuilding(false)}
 }
 if(building)return <section className="aiThinking" dir={dir}>
   <PhotoJourney building image={shownLoadingArt||undefined}/>
   <div className="thinkingCopy"><div className="tag">{a.tag}</div><h1>{a.thinking[step]}</h1><p>{form.prompt}</p><div className="thinkingSteps">{a.thinking.map((x,i)=><i className={i<=step?"on":""} key={x}></i>)}</div></div>
  </section>;
 if(phase==="planning")return <section className="aiThinking" dir={dir}>
   <PhotoJourney building image={shownLoadingArt||undefined}/>
   <div className="thinkingCopy"><div className="tag">{a.tag}</div><h1>{a.planningTitle}</h1><p>{form.prompt}</p></div>
  </section>;
 if(phase==="review"&&itinerary)return <section className="itineraryReview" dir={dir}>
  <div className="panel">
   <div className="aiTop"><div className="tag">{a.tag}</div></div>
   <h1>{a.reviewTitle}</h1><p>{a.reviewDesc}</p>
   <p className="contextHint">{lang==="he"?"זו תוכנית לבדיקה, עדיין לא חוויה שפורסמה. אפשר לערוך את הטקסט ולבחור הצעות. לחצו על אישור ובנייה כדי ליצור את המשימות בסטודיו.":"This is a plan to review, not a published experience. Edit the text and select suggestions, then approve and build to create the missions in the studio."}</p>
   <div className="itineraryPlan">
    {itinerary.plan.map(p=><div className="itineraryStep" key={p.step}>
     <div className="itineraryStepBadge">{isMultiDayFamilyTrip?a.dayBadge(p.step):a.partBadge(p.step)}</div>
     <input value={p.title} onChange={e=>updatePlanStep(p.step,{title:e.target.value})}/>
     <textarea value={p.summary} onChange={e=>updatePlanStep(p.step,{summary:e.target.value})}/>
    </div>)}
   </div>
   {itinerary.attractions?.length>0&&<div className="itineraryOptions">
    <div className="tag">{a.attractionsLabel}</div>
    {itinerary.attractions.map((att,i)=><label className="itineraryOptionRow" key={i}>
     <input type="checkbox" checked={selectedAttractionIds.has(i)} onChange={()=>toggleAttraction(i)}/>
     <div><b>{att.name}</b><p>{att.why}</p></div>
     <a href={att.url} target="_blank" rel="noopener noreferrer">🔗</a>
    </label>)}
   </div>}
   {itinerary.hotelsByDestination?.length>0?itinerary.hotelsByDestination.map(d=><div className="itineraryOptions" key={d.destination}>
    <div className="tag">{a.hotelsInLabel(d.destination)}</div>
    {(d.options||[]).map((h,i)=><label className="itineraryOptionRow" key={i}>
     <input type="radio" name={"itineraryHotel-"+d.destination} checked={selectedHotelByDestination[d.destination]===i} onChange={()=>setDestinationHotelIndex(d.destination,i)}/>
     <div><b>{h.name}</b><p>{h.why}</p></div>
     <a href={h.url} target="_blank" rel="noopener noreferrer">🔗</a>
    </label>)}
    {(d.options||[]).length>1&&<label className="itineraryOptionRow"><input type="radio" name={"itineraryHotel-"+d.destination} checked={selectedHotelByDestination[d.destination]===-2} onChange={()=>setDestinationHotelIndex(d.destination,-2)}/><div><b>{a.letGroupVote}</b><p>{a.letGroupVoteDesc}</p></div></label>}
    <label className="itineraryOptionRow"><input type="radio" name={"itineraryHotel-"+d.destination} checked={selectedHotelByDestination[d.destination]===-1} onChange={()=>setDestinationHotelIndex(d.destination,-1)}/><div><b>{a.noHotelOption}</b></div></label>
   </div>):itinerary.hotels?.length>0&&<div className="itineraryOptions">
    <div className="tag">{a.hotelsLabel}</div>
    {itinerary.hotels.map((h,i)=><label className="itineraryOptionRow" key={i}>
     <input type="radio" name="itineraryHotel" checked={selectedHotelIndex===i} onChange={()=>setSelectedHotelIndex(i)}/>
     <div><b>{h.name}</b><p>{h.why}</p></div>
     <a href={h.url} target="_blank" rel="noopener noreferrer">🔗</a>
    </label>)}
    {itinerary.hotels.length>1&&<label className="itineraryOptionRow"><input type="radio" name="itineraryHotel" checked={selectedHotelIndex===-2} onChange={()=>setSelectedHotelIndex(-2)}/><div><b>{a.letGroupVote}</b><p>{a.letGroupVoteDesc}</p></div></label>}
    <label className="itineraryOptionRow"><input type="radio" name="itineraryHotel" checked={selectedHotelIndex===-1} onChange={()=>setSelectedHotelIndex(-1)}/><div><b>{a.noHotelOption}</b></div></label>
   </div>}
   <div className="actions">
    <button onClick={()=>setPhase("form")}>{a.backToDetails}</button>
    <button onClick={goPlan}>🔄 {a.regeneratePlan}</button>
    <button className="primary" onClick={build}>✦ {a.approveAndBuild}</button>
   </div>
  </div>
 </section>;
 return <section className="aiCreate grid2" dir={dir}>
  <div className="panel">
   <div className="aiTop"><div className="tag">{a.tag}</div></div>
   <h1>{a.title}</h1><p>{a.desc}</p>
   <div className="aiStepIntro"><small>{lang==="he"?`שלב ${formStep} מתוך 3`:`Step ${formStep} of 3`}</small><h2 id="ai-step-heading" tabIndex={-1}>{stepTitles[formStep-1]}</h2><p>{lang==="he"?(formStep===1?"תארו את הרעיון בכמה מילים. התיאור הוא שדה חובה; סוג ומיקום עוזרים להתאים את החוויה.":formStep===2?"הוסיפו זמן והרכב משתתפים כדי להתאים את המסלול. בטיול עם לינה, תאריכים וגילי ילדים עוזרים לדייק את החיפוש.":"הוסיפו תחומי עניין, גילאים או בקשות מיוחדות. אפשר להשאיר ריק ולהמשיך לתכנון."):(formStep===1?"Describe your idea. A description is required; type and location help personalize it.":formStep===2?"Add timing and participants to tailor the route. For overnight trips, dates and children's ages help refine searches.":"Add interests, ages or special requests. You can leave this blank and continue to planning.")}</p></div>
   {stepError&&<p className="guidanceError" role="alert">{stepError}</p>}
   <div className={"aiFormStep "+(formStep===1?"active":"")} data-step="1">
    <label htmlFor="ai-description">{a.prompt} *</label><textarea id="ai-description" className="aiPrompt" aria-required="true" aria-invalid={!!stepError} placeholder={lang==="he"?"לדוגמה: יום כיף בחי פארק עם ילדים בני 7–10, חידות קלילות ומשימות צילום.":"For example: a family day at the zoo with ages 7–10, easy riddles and photo missions."} value={form.prompt} onChange={e=>{setForm({...form,prompt:e.target.value});setStepError("")}}/>
    <div className="fieldRow"><div><label>{a.type}</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option>{TYPE_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div>{!isMultiDayFamilyTrip&&<div><label>{a.location}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div>}</div>
    {isMultiDayFamilyTrip&&<div className="destinationsField">
     <label>{a.destinationsLabel} *</label>
     <p className="destinationsHint">{a.destinationsHint}</p>
     <div className="destinationInputRow">
      <input value={destinationInput} placeholder={a.destinationPlaceholder} onChange={e=>setDestinationInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addDestination()}}}/>
      <button type="button" onClick={addDestination}>+ {a.addDestination}</button>
     </div>
     {form.destinations.length>0&&<div className="chipRow">{form.destinations.map(d=><button type="button" key={d} className="chip selected" onClick={()=>removeDestination(d)}>{d} ✕</button>)}</div>}
    </div>}
    {/birthday|יום הולדת/i.test(form.type)&&<CelebrationPhotoPicker file={portraitFile} onChange={setPortraitFile} lang={lang}/>}
   </div>

   <div className={"aiFormStep "+(formStep===2?"active":"")} data-step="2">
    {isMultiDayFamilyTrip?
     <div className="fieldRow"><div><label>{a.startDate}</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,endDate:form.endDate&&form.endDate<e.target.value?"":form.endDate})}/></div><div><label>{a.endDate}</label><input type="date" min={form.startDate||undefined} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div></div>
     :isSingleDayFamilyTrip?
     <div className="fieldRow"><div><label>{a.duration}</label><select value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}><option value=""></option>{DURATION_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
     :<div className="fieldRow"><div><label>{a.duration}</label><select value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}><option value=""></option>{DURATION_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label>{a.people}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></div></div>}
    {isMultiDayFamilyTrip&&<div className="fieldRow"><div><label>{a.days}</label><div className="tripLengthDisplay">{tripDays?a.tripLength(tripDays):"—"}</div></div></div>}
    {isFamilyTrip&&<div className="hotelPartyBox"><div className="tag">{isMultiDayFamilyTrip?(lang==="he"?"הרכב לאירוח":"Stay party"):(lang==="he"?"הרכב משפחתי":"Family composition")}</div><div className="fieldRow"><div><label>{lang==="he"?"מבוגרים":"Adults"}</label><input type="number" min="1" max="12" value={form.adults} onChange={e=>setForm({...form,adults:e.target.value})}/></div><div><label>{lang==="he"?"ילדים":"Children"}</label><input type="number" min="0" max="8" value={form.children} onChange={e=>setChildrenCount(e.target.value)}/></div></div>{Number(form.children)>0&&<div className="childrenAges"><label>{isMultiDayFamilyTrip?(lang==="he"?"גילי הילדים — כדי למצוא חדר ומחיר מתאימים":"Children ages — for accurate rooms and pricing"):(lang==="he"?"גילי הילדים":"Children ages")}</label><div className="ageGrid">{form.childrenAges.map((age,i)=><input key={i} type="number" min="0" max="17" placeholder={(lang==="he"?"ילד ":"Child ")+(i+1)} value={age} onChange={e=>setChildAge(i,e.target.value)}/>)}</div></div>}</div>}
   </div>

   <div className={"aiFormStep "+(formStep===3?"active":"")} data-step="3">
    <label>{a.peopleDetails}</label><textarea className="peopleDetailsInput" placeholder={a.peopleDetailsPlaceholder} value={form.peopleDetails} onChange={e=>setForm({...form,peopleDetails:e.target.value})}/>
    {isMultiDayFamilyTrip&&<label className="hotelCheck"><input type="checkbox" checked={form.hotelBooked} onChange={e=>setForm({...form,hotelBooked:e.target.checked})}/> {a.hotel}</label>}
    {isFamilyTrip&&<div className="interestsField"><label>{a.interests}</label><div className="chipRow">{Object.keys(a.interestOptions).map(key=><button type="button" key={key} className={"chip "+(form.interests.includes(key)?"selected":"")} onClick={()=>toggleInterest(key)}>{a.interestOptions[key]}</button>)}</div></div>}
   </div>

   <div className="stepNav">
    <span className="stepIndicator">{lang==="he"?`שלב ${formStep} מתוך ${TOTAL_STEPS}`:`Step ${formStep} of ${TOTAL_STEPS}`}</span>
    <div className="stepNavBtns">
     {formStep>1&&<button type="button" onClick={goBack}>{lang==="he"?"→ הקודם":"← Back"}</button>}
     {formStep<TOTAL_STEPS&&<button type="button" className="primary" onClick={goNext}>{lang==="he"?(formStep===1?"המשך לזמן ולמשתתפים ←":"המשך להעדפות ←"):(formStep===1?"Next: timing & people →":"Next: preferences →")}</button>}
    </div>
   </div>

   {planError&&<div className="planError">⚠ {planError}</div>}
   {formStep===TOTAL_STEPS&&<><div className="actions finalActions"><button className="primary aiBuildButton" onClick={goPlan}>✦ {a.planTrip}</button></div><p className="contextHint">{lang==="he"?"קודם תקבלו תוכנית לאישור. החוויה לא תפורסם בלי שתבחרו לפרסם אותה.":"You'll review a plan first. The experience won't be published until you choose to publish it."}</p></>}
  </div>
  <div className="panel aiPromise photoPromise">
   <PhotoJourney image={shownHeroArt||undefined}/>
   <h2>{a.promiseTitle1}<br/>{a.promiseTitle2}</h2><p>{a.promiseDesc}</p>
   <div className="brandArtRow" title={canGenerateArt?"":(lang==="he"?"מלאו תיאור וסוג חוויה כדי ליצור תמונה מותאמת":"Fill in a description and experience type to generate matching art")}>
    <button type="button" className="brandArtBtn" disabled={!canGenerateArt||!!generatingKey} onClick={()=>generateArt("aiCreatorHero",setCustomHeroArt)}>
     {generatingKey==="aiCreatorHero"?(lang==="he"?"✨ יוצר תמונה…":"✨ Generating…"):customHeroArt?(lang==="he"?"🔄 ייצר מחדש":"🔄 Regenerate"):(lang==="he"?"✨ ייצר תמונה מותאמת ב-AI":"✨ Generate personalized art")}
    </button>
    <button type="button" className="brandArtBtn brandArtBtnGhost" disabled={!canGenerateArt||!!generatingKey} onClick={()=>generateArt("bookBuildingHero",setCustomLoadingArt)}>
     {generatingKey==="bookBuildingHero"?(lang==="he"?"✨ יוצר תמונה…":"✨ Generating…"):customLoadingArt?(lang==="he"?"🔄 ייצר מחדש רקע טעינה":"🔄 Regenerate loading art"):(lang==="he"?"✨ ייצר רקע מותאם למסך הטעינה":"✨ Generate personalized loading art")}
    </button>
   </div>
  </div>
 </section>
}
