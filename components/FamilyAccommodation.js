"use client";
import bookingLinks from "../functions/bookingLinks";
import {tx} from "../lib/i18n";
import familiesDomain from "../functions/families";
export default function FamilyAccommodation({experience,lang,familyId}){
 const families=(experience.families||[]).filter(f=>!familyId||f.id===familyId);
 if(!families.length)return null;
 return <section className="familyPassport"><h3>{tx(lang,"לינה לפי הרכב המשפחה","Stays for each family")}</h3>{families.map(f=><p key={f.id}><b>{f.name}</b> · {f.adults} + {f.children} · {f.rooms||1} {tx(lang,"חדרים","rooms")} · <a href={bookingLinks.bookingUrl(familiesDomain.familyBookingUrl(f,experience.location,experience.startDate,experience.endDate),experience,f.id)} target="_blank" rel="noopener noreferrer">{tx(lang,"חיפוש לינה להרכב הזה","Search stays for this family")}</a></p>)}<small>{tx(lang,"החיפוש כולל את גילי הילדים. יש לאמת תפוסה וזמינות מול מקום האירוח.","Search includes children’s ages. Confirm occupancy and availability with the property.")}</small></section>;
}
