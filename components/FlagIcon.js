"use client";
// Real vector flags instead of Unicode flag emoji - many Android WebViews (and some
// desktop fonts) render regional-indicator emoji as blank/black boxes, so emoji flags
// are not a reliable cross-platform choice for a switcher people need to read at a glance.
const FLAGS = {
 US: <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#b22234"/>
  {[0,1,2,3,4,5,6].map(i=><rect key={i} y={i*(20/13)*2} width="30" height={20/13} fill="#fff"/>)}
  <rect width="14" height={(20/13)*7} fill="#3c3b6e"/>
 </svg>,
 GB: <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#00247d"/>
  <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="4"/>
  <path d="M0,0 L30,20 M30,0 L0,20" stroke="#cf142b" strokeWidth="1.6"/>
  <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6.6"/>
  <path d="M15,0 V20 M0,10 H30" stroke="#cf142b" strokeWidth="4"/>
 </svg>,
 IL: <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/>
  <rect y="2.2" width="30" height="2.6" fill="#0038b8"/><rect y="15.2" width="30" height="2.6" fill="#0038b8"/>
  <g stroke="#0038b8" strokeWidth="0.8" fill="none"><polygon points="15,6.2 18.4,12.2 11.6,12.2"/><polygon points="15,13.8 18.4,7.8 11.6,7.8"/></g>
 </svg>,
 DE: <svg viewBox="0 0 30 20"><rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/></svg>,
 PL: <svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/></svg>,
 GR: <svg viewBox="0 0 30 20">
  <rect width="30" height="20" fill="#0d5eaf"/>
  {[0,2,4,6,8].map(i=><rect key={i} y={i*20/9} width="30" height={20/9} fill="#fff"/>)}
  <rect width="11" height="11.1" fill="#0d5eaf"/>
  <rect x="4.1" width="2.8" height="11.1" fill="#fff"/><rect y="4.1" width="11" height="2.8" fill="#fff"/>
 </svg>,
 HU: <svg viewBox="0 0 30 20"><rect width="30" height="6.67" fill="#cd2a3e"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#436f4d"/></svg>,
 JP: <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>,
 IT: <svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/></svg>,
 TH: <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/>
  <rect width="30" height="3.33" fill="#a51931"/><rect y="16.67" width="30" height="3.33" fill="#a51931"/>
  <rect y="6.67" width="30" height="6.67" fill="#2d2a4a"/>
 </svg>,
};
export default function FlagIcon({code}){
 const svg=FLAGS[code];
 if(!svg)return null;
 return <span className="flagIcon" aria-hidden="true">{svg}</span>;
}
