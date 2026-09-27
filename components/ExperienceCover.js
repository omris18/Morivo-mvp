import {getExperienceTheme} from "../lib/experienceVisuals";
export default function ExperienceCover({experience,children,className=""}) {
  const theme=getExperienceTheme(experience);
  const cartoonUrl=experience.celebrationPortrait?.cartoonUrl;
  return <div className={"experienceCover "+className} style={{"--cover-accent":theme.accent}}>
    <img src={cartoonUrl||theme.image} alt="" loading="lazy"/>
    <div className="experienceCoverShade"/>
    {children}
  </div>;
}
