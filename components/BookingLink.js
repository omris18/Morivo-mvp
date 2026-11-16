"use client";
import {createContext,useContext} from 'react';
import bookingLinks from '../functions/bookingLinks';
const BookingContext=createContext({experience:{},familyId:null});
export function BookingProvider({experience,familyId=null,children}){return <BookingContext.Provider value={{experience,familyId}}>{children}</BookingContext.Provider>}
export default function BookingLink({href,children,...props}){const {experience,familyId}=useContext(BookingContext);return <a {...props} href={bookingLinks.bookingUrl(href,experience,familyId)}>{children}</a>}
