const items=[
["dashboard","⌂","Dashboard"],["create","＋","Create"],["studio","✦","Studio"],
["runtime","▶","Runtime"],["participant","◉","Participant"],["memory","▣","Memory"]
];
export default function Sidebar({view,setView}){
 return <aside className="sidebar">
   <div className="brand">◆ Morivo</div>
   <div className="tag">Experience OS</div>
   <nav>{items.map(([id,icon,label])=><button key={id} onClick={()=>setView(id)} className={view===id?"active":""}>
    <span>{icon}</span>{label}
   </button>)}</nav>
 </aside>
}
