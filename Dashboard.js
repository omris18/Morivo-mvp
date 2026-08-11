export default function Dashboard({experience,setView}){
 return <section>
   <div className="hero">
     <div className="tag">Morivo Experience OS</div>
     <h1>Build moments people will <span>remember.</span></h1>
     <p>Create, run and preserve interactive experiences from one workspace.</p>
     <div className="actions">
       <button className="primary" onClick={()=>setView("create")}>＋ Create Experience</button>
       <button onClick={()=>setView("studio")}>Open Demo Experience</button>
     </div>
   </div>
   <div className="kpis">
     <div><small>Experiences</small><b>3</b></div><div><small>Participants</small><b>48</b></div>
     <div><small>Missions completed</small><b>126</b></div><div><small>Memories created</small><b>312</b></div>
   </div>
   <div className="panel">
     <div className="row"><div><div className="tag">Current experience</div><h2>{experience.name}</h2><p>{experience.story}</p></div><span className="pill">{experience.status}</span></div>
     <div className="actions"><button onClick={()=>setView("studio")}>Edit in Studio</button><button className="primary" onClick={()=>setView("runtime")}>Run Experience</button></div>
   </div>
 </section>
}
