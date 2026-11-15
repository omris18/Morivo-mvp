"use client";
import {useEffect,useState} from "react";
import MemoryAlbum from "../../components/MemoryAlbum";
const photos=[
 {id:"greece-1",downloadURL:"https://images.unsplash.com/photo-1587240853629-754e6107fca1?w=1200&q=85",participantName:"אמא · בוקר מעל הים",missionTitle:"סמטאות סנטוריני"},
 {id:"greece-2",downloadURL:"https://images.unsplash.com/photo-1743427495409-bf19fdaa4c16?w=1200&q=85",participantName:"אבא · העצירה הכי יפה",missionTitle:"כיפה כחולה מול הים"},
 {id:"gelato",downloadURL:"https://images.unsplash.com/photo-1589999637259-3c7abefd93eb?w=1200&q=85",participantName:"הילדים · גלידה בדרך",missionTitle:"רגע מתוק"}
];
const chapters=[
 {key:"arrival",index:0,mission:{title:"החופשה מתחילה בכחול"},photos:photos.slice(0,2),quotes:[{id:"q1",text:"פתחנו את החלון וראינו ים מכל כיוון. הקטן שאל אם אפשר לאכול ארוחת בוקר בחוץ גם כשנחזור הביתה.",participantName:"אמא"}]},
 {key:"sweet",index:1,mission:{title:"לא צריך הרבה כדי להיות בחופש"},photos:[photos[2],photos[0],photos[1]],quotes:[{id:"q2",text:"אני בחרתי את הטעם. אבא ביקש רק ביס אחד. זה היה הביס הכי גדול בעולם!",participantName:"הבת הקטנה"},{id:"q3",text:"היום לא ספרנו צעדים. ספרנו כמה פעמים עצרנו כדי להסתכל על הים.",participantName:"אבא"}]},
 {key:"last",index:2,mission:{title:"מה ניקח איתנו הביתה"},photos:[photos[1]],quotes:[{id:"q4",text:"את הצחוק בדרך, את הבוקר בלי שעון ואת הזמן שהיה רק שלנו. התמונה מזכירה את המקום; המילים מזכירות איך הרגשנו.",participantName:"כולנו"}]}
];
export default function Demo(){const [seed,setSeed]=useState("greece-2026"),[lang,setLang]=useState("he"),[phone,setPhone]=useState(false);useEffect(()=>{try{const s=localStorage.getItem('morivo-album-demo-v1');if(s)setSeed(s)}catch{}},[]);const he=lang==='he';return <main dir={he?'rtl':'ltr'} style={{minHeight:'100vh',background:'#e9eef5',padding:'clamp(10px,3vw,40px)',color:'#193b91'}}>
 <div style={{maxWidth:1150,margin:'0 auto'}}><header style={{display:'flex',gap:18,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',marginBottom:25}}><div><small>MORIVO / MEMORY BOOK</small><h1 style={{color:'#193b91',margin:'8px 0'}}>הקיץ שלנו ביוון</h1><p>דוגמה חיה · תמונות מאגר וסיפור משפחתי בדוי</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>setLang(he?'en':'he')}>עברית / English</button><button onClick={()=>setPhone(!phone)}>{phone?'תצוגה רחבה':'תצוגת טלפון'}</button><button onClick={()=>window.print()}>הדפסה / PDF</button><a href="/">חזרה ל־Morivo</a></div></header>
 <div style={{maxWidth:phone?390:1150,margin:'0 auto',transition:'max-width .2s'}}><MemoryAlbum key={lang} chapters={chapters} lang={lang} seed={seed} canEdit onSaveDesign={async d=>{localStorage.setItem('morivo-album-demo-v1',d.seed);setSeed(d.seed)}}/></div>
 <p style={{fontSize:12,textAlign:'center'}}>תמונות: Andreas M, Travis Fish, Myfanwy Owen / Unsplash. בדוגמה העיצוב נשמר במכשיר זה; בספר חוויה הוא נשמר בחשבון.</p></div></main>}
