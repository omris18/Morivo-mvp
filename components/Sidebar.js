const items=["dashboard","ai","create","studio","runtime","memory"];
const icons={
 dashboard:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-13h6V4h-6v3Z"/></svg>,
 ai:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 5.2L18 9l-4.5 1.8L12 16l-1.5-5.2L6 9l4.5-1.8L12 2Zm7 12 .8 2.7L22 18l-2.2 1.3L19 22l-.8-2.7L16 18l2.2-1.3L19 14ZM5 13l.9 3.1L9 17.5l-3.1 1.4L5 22l-.9-3.1L1 17.5l3.1-1.4L5 13Z"/></svg>,
 create:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z"/></svg>,
 studio:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h10v2H4V5Zm0 6h16v2H4v-2Zm0 6h7v2H4v-2Zm13-13 3 3-3 3V4Zm-3 12 3 3-3 3v-6Z"/></svg>,
 runtime:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>,
 memory:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Zm2 14h10V5H6v12.2c.3-.1.7-.2 1-.2Zm2-9h6v2H9V8Zm0 4h5v2H9v-2Z"/></svg>
};
export default function Sidebar({view,setView,t}){
 return <aside className="sidebar">
   <div className="brandLockup"><div className="brandMark"><span></span><span></span><span></span></div><div><div className="brand">{t.brand}</div><div className="tag">{t.brandTag}</div></div></div>
   <nav>{items.map(id=>
     <button key={id} onClick={()=>setView(id)} className={view===id?"active":""}>
      <span className="navIcon">{icons[id]}</span><span>{t.nav[id]}</span>
     </button>
   )}</nav>
   <div className="sidebarJourney"><div className="journeyLine"></div><small>CREATE · LIVE · REMEMBER</small></div>
 </aside>
}