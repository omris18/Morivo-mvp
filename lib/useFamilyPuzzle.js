"use client";
import {puzzleCompletedIds} from "./familyPuzzle";
import {useEffect,useState} from "react";
import {subscribeFamilyBook,subscribeAllProgress} from "./morivoData";
export function useFamilyPuzzle(experience,familyId,individualProgress={}){
 const [book,setBook]=useState(null),[rows,setRows]=useState([]);
 useEffect(()=>{setBook(null);setRows([]);if(!experience.id||!familyId)return;const a=subscribeFamilyBook(experience.id,familyId,b=>setBook({...b,_familyId:familyId})),c=subscribeAllProgress(experience.id,p=>setRows(p),familyId);return()=>{a();c()}},[experience.id,familyId]);
 return {puzzle:experience.families?.length?(book?._familyId===familyId?book.familyPuzzle:null):experience.familyPuzzle,completedIds:puzzleCompletedIds(experience.flow||[],familyId?rows.filter(r=>r.familyId===familyId):[individualProgress])};
}
