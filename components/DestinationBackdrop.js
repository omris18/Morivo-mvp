export default function DestinationBackdrop({theme}){
 return <div aria-hidden="true" className={"destinationBackdrop destination-"+theme.key} style={{backgroundImage:`url("${theme.image||'/route-journey.svg'}")`,backgroundSize:"cover",backgroundPosition:"center"}}>{theme.portrait&&<div className="celebrationPortraitFrame"><img src={theme.portrait} alt=""/><span>🎈 🎂 🎈</span></div>}</div>;
}
