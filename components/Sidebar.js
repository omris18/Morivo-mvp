const items=["dashboard","ai","create","studio","runtime","participant","memory"];
const icons={dashboard:"⌂",ai:"✨",create:"＋",studio:"✦",runtime:"▶",participant:"◉",memory:"▣"};
export default function Sidebar({view,setView,t}){
 return <aside className="sidebar">
   <div className="brand">◆ {t.brand}</div>
   <div className="tag">{t.brandTag}</div>
   <nav>{items.map(id=><button key={id} onClick={()=>setView(id)} className={view===id?"active":""}>
    <span>{icons[id]}</span>{t.nav[id]}
   </button>)}</nav>
 </aside>
}
