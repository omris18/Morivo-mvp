export default function PhotoJourney({building=false,image}) {
 return <div className={"photoJourney "+(building?"photoJourneyBuilding":"")} aria-hidden="true">
  <img className="journeyLandscape" src={image||"/morivo-coast.svg"} alt="" fetchPriority="high"/>
  <div className="photoTrail"></div>
  <div className="journeyPhoto journeyPhotoPlace"><img src="/morivo-coast.svg" alt=""/></div>
  <div className="journeyPhoto journeyPhotoBook"><img src="/morivo-memories.svg" alt=""/></div>
  <span className="photoSpark">✦</span>
 </div>;
}
