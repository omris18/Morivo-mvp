import {getExperienceTheme} from "../lib/experienceVisuals";
export default function ExperienceCover({experience,children,className=""}) {
  const theme=getExperienceTheme(experience);
  return <div className={"experienceCover "+className} style={{"--cover-accent":theme.accent}}>
    <img src={theme.image} alt="" loading="lazy"/>
    <div className="experienceCoverShade"/>
    {children}
  </div>;
}
