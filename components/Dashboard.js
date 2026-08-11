export default function Dashboard({experience,experiences,setView,openExperience}){
 const rows=experiences?.length ? experiences : [experience];
 return <section>
   <div className="hero">
     <div className="tag">Morivo Experience OS</div>
     <h1>Build moments people will <span>remember.</span></h1>
     <p>Create, run and preserve interactive experiences from one workspace.</p>
     <div className="actions">
       <button className="primary" onClick={()=>setView("create")}>＋ Create Experience</button>
     </div>
   </div>
   <div className="kpis">
     <div><small>Experiences</small><b>{rows.length}</b></div><div><small>Participants</small><b>48</b></div>
     <div><small>Missions completed</small><b>126</b></div><div><small>Memories created</small><b>312</b></div>
   </div>
   <div className="panel">
     <div className="tag">Your experiences</div>
     {rows.map(x=><div className="experienceRow" key={x.id}>
       <div><h3>{x.name}</h3><p>{x.location || x.type} · {x.status || "draft"}</p></div>
       <button onClick={()=>openExperience(x)}>Open</button>
     </div>)}
   </div>
 </section>
}
