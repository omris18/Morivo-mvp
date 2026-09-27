export default function DestinationBackdrop({theme}){
 return <div aria-hidden="true" className={"destinationBackdrop destination-"+theme.key} style={theme.scene!==null?{backgroundImage:'url("/morivo-destinations.svg")',backgroundSize:"300% auto",backgroundPosition:(theme.scene*50)+"% center"}:undefined}/>;
}
