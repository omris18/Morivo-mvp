"use client";

import { useEffect, useState, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import QRCode from "qrcode";
import { firebaseConfigured, functions } from "../lib/firebase";
import { publishExperienceRemote, updateExperienceRemote, reorderExperienceRemote, uploadFamilyPhoto, removeFamilyPuzzle, reshuffleFamilyPuzzleLayout } from "../lib/morivoData";
import LinkifiedText from "./LinkifiedText";
import ExperienceShare from "./ExperienceShare";
import {missionLabels} from "../lib/experienceGuidance";
import missionAnswers from "../functions/missionAnswers";
import { getCurrentPosition, geocodeAddress } from "../lib/geo";
import { pieceAtGridIndex } from "../lib/familyPuzzle";
import { enableOrganizerPushNotifications, pushSupported } from "../lib/push";

export default function Studio({ experience, setExperience, setView, t, lang }) {
  const he=lang==="he",labels=missionLabels[he?"he":"en"];
  const [justPublished,setJustPublished]=useState(false);
  useEffect(()=>{if(justPublished)document.getElementById("experience-share")?.scrollIntoView({behavior:"smooth",block:"center"})},[justPublished]);
  const s = t.studio;
  const flow = experience.flow || [];
  const [selected, setSelected] = useState(flow[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [revising, setRevising] = useState(false);
  const [revisePrompt, setRevisePrompt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [qrImgUrl, setQrImgUrl] = useState(null);
  const [scrollToInspector, setScrollToInspector] = useState(false);
  const inspectorRef = useRef(null);
  const titleInputRef = useRef(null);
  const [puzzlePhotoSaving, setPuzzlePhotoSaving] = useState(false);
  const [puzzlePhotoError, setPuzzlePhotoError] = useState("");
  const [puzzlePhotoPreview, setPuzzlePhotoPreview] = useState(null);
  useEffect(()=>()=>{if(puzzlePhotoPreview)URL.revokeObjectURL(puzzlePhotoPreview)},[puzzlePhotoPreview]);
  const [puzzleShuffling, setPuzzleShuffling] = useState(false);
  const [puzzleShuffleError, setPuzzleShuffleError] = useState("");
  const [puzzleRemoving, setPuzzleRemoving] = useState(false);
  const [flightAlertsState, setFlightAlertsState] = useState("idle");

  const atom = flow.find((x) => x.id === selected) || null;

  useEffect(() => { setAddressInput(atom?.address || ""); setGeocodeError(""); }, [atom?.id]);

  useEffect(() => {
    if (scrollToInspector && atom && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      titleInputRef.current?.focus();
      setScrollToInspector(false);
    }
  }, [scrollToInspector, atom]);

  useEffect(() => {
    if (atom?.type === "map" && atom.qrCode) {
      QRCode.toDataURL(atom.qrCode, { margin: 1, width: 160, color: { dark: "#050b13", light: "#ffffff" } })
        .then(setQrImgUrl)
        .catch(() => setQrImgUrl(null));
    } else {
      setQrImgUrl(null);
    }
  }, [atom?.qrCode, atom?.type]);

  function generateQr() {
    if (!Number.isFinite(atom?.lat) || !Number.isFinite(atom?.lng)) return;
    patch({ qrCode: `https://www.google.com/maps/search/?api=1&query=${atom.lat},${atom.lng}` });
  }

  useEffect(() => {
    if (!selected && flow[0]) {
      setSelected(flow[0].id);
    }

    if (selected && !flow.some((x) => x.id === selected)) {
      setSelected(flow[0]?.id || null);
    }
  }, [flow, selected]);

  async function persist(next) {
    setExperience(next);

    if (
      firebaseConfigured &&
      next.id &&
      !next.id.startsWith("local-") &&
      next.id !== "thailand-demo"
    ) {
      setSaving(true);
      setSaveError(false);
      try {
        const oldIds=(experience.flow||[]).map(m=>m.id),newIds=(next.flow||[]).map(m=>m.id);
        const reordered=oldIds.length===newIds.length&&oldIds.every(id=>newIds.includes(id))&&JSON.stringify(oldIds)!==JSON.stringify(newIds);
        if(reordered){await reorderExperienceRemote(next.id,newIds,oldIds);return;}
        await updateExperienceRemote(next.id, {
          flow: next.flow,
          name: next.name,
          story: next.story,
          type: next.type,
          location: next.location,
          people: next.people,
          flights: next.flights || [],
          adultsCount: next.adultsCount || 0,
          childrenCount: next.childrenCount || 0,
        });
      } catch (e) {
        setExperience(experience);
        setSaveError(true);
        alert(s.saveFailed(e.message));
      } finally {
        setSaving(false);
      }
    }
  }

  function patch(values) {
    if (!atom) return;

    const nextFlow = flow.map((x) =>
      x.id === atom.id ? { ...x, ...values } : x
    );

    persist({ ...experience, flow: nextFlow });
  }

  function addFlight() {
    const flights = [...(experience.flights || []), { id: `flight-${Date.now()}`, flightNumber: "", date: "", time: "", direction: "outbound" }];
    persist({ ...experience, flights });
  }

  function updateFlight(flightId, values) {
    const flights = (experience.flights || []).map((f) => f.id === flightId ? { ...f, ...values } : f);
    persist({ ...experience, flights });
  }

  function removeFlight(flightId) {
    const flights = (experience.flights || []).filter((f) => f.id !== flightId);
    persist({ ...experience, flights });
  }

  async function setCheckpointHere() {
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      patch({ lat, lng });
    } catch (e) {
      alert(e.message);
    } finally {
      setLocating(false);
    }
  }

  async function findByAddress() {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    setGeocodeError("");
    try {
      const { lat, lng } = await geocodeAddress(addressInput.trim());
      patch({ lat, lng, address: addressInput.trim() });
    } catch (e) {
      setGeocodeError(e.message);
    } finally {
      setGeocoding(false);
    }
  }

  async function reviseWithAI() {
    if (!revisePrompt.trim()) return;
    if (!flow.length) return alert(s.addAtLeastOneMission);
    setRevising(true);
    try {
      const revise = httpsCallable(functions, "reviseExperience");
      const result = await revise({ flow, instruction: revisePrompt.trim(), prompt: experience.story, location: experience.location, lang: experience.lang });
      await persist({ ...experience, flow: result.data.flow });
      setRevisePrompt("");
    } catch (e) {
      alert(e.message);
    } finally {
      setRevising(false);
    }
  }

  function add(type) {
    const newAtom = {
      id: `${type}-${Date.now()}`,
      type,
      title: s.newMissionTitle(labels[type]),
      text: "",
      reward: `100 ${s.pointsSuffix}`,
      points: 100,
      ...(type === "branch" ? { options: [
        { id: `opt-${Date.now()}-1`, label: "", next: "" },
        { id: `opt-${Date.now()}-2`, label: "", next: "" },
      ] } : {}),
      ...(type === "quiz" ? { options: ["", "", ""], answer: "" } : {}),
    };

    persist({
      ...experience,
      flow: [...flow, newAtom],
    });

    setSelected(newAtom.id);
    setScrollToInspector(true);
  }

  function addBranchOption() {
    if (!atom) return;
    const options = [...(atom.options || []), { id: `opt-${Date.now()}`, label: "", next: "" }];
    patch({ options });
  }

  function updateBranchOption(optionId, values) {
    if (!atom) return;
    const options = (atom.options || []).map((o) => o.id === optionId ? { ...o, ...values } : o);
    patch({ options });
  }

  function removeBranchOption(optionId) {
    if (!atom) return;
    patch({ options: (atom.options || []).filter((o) => o.id !== optionId) });
  }

  function addQuizOption() {
    if (!atom) return;
    patch({ options: [...(atom.options || []), ""] });
  }

  function updateQuizOption(index, value) {
    if (!atom) return;
    const prevValue = (atom.options || [])[index];
    const options = (atom.options || []).map((o, i) => (i === index ? value : o));
    const answer = atom.answer !== "" && atom.answer === prevValue ? value : atom.answer;
    patch({ options, answer });
  }

  function removeQuizOption(index) {
    if (!atom) return;
    const removed = (atom.options || [])[index];
    const options = (atom.options || []).filter((_, i) => i !== index);
    const answer = atom.answer !== "" && atom.answer === removed ? "" : atom.answer;
    patch({ options, answer });
  }

  function addLinkOption() {
    if (!atom) return;
    const options = [...(atom.options || []), { id: `opt-${Date.now()}`, name: "", why: "", url: "" }];
    patch({ options });
  }

  function updateLinkOption(optionId, values) {
    if (!atom) return;
    const options = (atom.options || []).map((o) => o.id === optionId ? { ...o, ...values } : o);
    patch({ options });
  }

  function removeLinkOption(optionId) {
    if (!atom) return;
    patch({ options: (atom.options || []).filter((o) => o.id !== optionId) });
  }

  function setQuizCorrect(index) {
    if (!atom) return;
    patch({ answer: (atom.options || [])[index] || "" });
  }

  function move(direction) {
    if (!atom) return;

    const currentIndex = flow.findIndex((x) => x.id === atom.id);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= flow.length) return;

    const nextFlow = [...flow];
    [nextFlow[currentIndex], nextFlow[targetIndex]] = [
      nextFlow[targetIndex],
      nextFlow[currentIndex],
    ];

    persist({ ...experience, flow: nextFlow });
  }

  function remove() {
    if (!atom) return;
    if (!window.confirm(s.confirmDelete(atom.title))) return;

    const nextFlow = flow.filter((x) => x.id !== atom.id);

    persist({
      ...experience,
      flow: nextFlow,
    });

    setSelected(nextFlow[0]?.id || null);
  }

  function duplicate() {
    if (!atom) return;

    const copy = { ...atom, id: `${atom.type}-${Date.now()}` };
    const index = flow.findIndex((x) => x.id === atom.id);
    const nextFlow = [...flow.slice(0, index + 1), copy, ...flow.slice(index + 1)];

    persist({ ...experience, flow: nextFlow });
    setSelected(copy.id);
  }

  async function publish() {
    if (publishing) return;

    if (!flow.length) {
      alert(s.addAtLeastOneMission);
      return;
    }

    if (!firebaseConfigured) {
      setExperience({
        ...experience,
        status: "live",
        joinCode: "MORIVO26",
      });

      alert(s.publishedDemo("MORIVO26"));
      return;
    }

    setPublishing(true);
    try {
      const code = await publishExperienceRemote(experience);

      setExperience({
        ...experience,
        status: "live",
        joinCode: code,
      });

      setJustPublished(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="grid2 studioPage">
      <div className="panel studioWorkspace">
        {justPublished&&<ExperienceShare experience={experience} lang={lang} setView={setView} afterPublish/>}
        <div className="studioHeader"><div><div className="tag">
          {s.savingTag} · {saving ? s.saving : saveError ? s.saveErrorTag : s.saved}
        </div><h2>{experience.name || s.untitled}</h2></div><div className={"savePill "+(saveError?"error":saving?"saving":"saved")}><i></i>{saving ? s.saving : saveError ? s.saveErrorTag : s.saved}</div></div>

        <div className="tripDetails">
          <div className="tag">{s.tripDetailsTag}</div>
          <div className="fieldRow">
            <div>
              <label>{s.adultsLabel}</label>
              <input type="number" min="0" value={experience.adultsCount || 0}
                onChange={(e) => persist({ ...experience, adultsCount: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <label>{s.childrenLabel}</label>
              <input type="number" min="0" value={experience.childrenCount || 0}
                onChange={(e) => persist({ ...experience, childrenCount: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
          </div>
          <label>{s.flightsLabel}</label>
          {(experience.flights || []).map((f) => (
            <div className="flightRow" key={f.id}>
              <input placeholder={s.flightNumberPlaceholder} value={f.flightNumber || ""} onChange={(e) => updateFlight(f.id, { flightNumber: e.target.value })} />
              <input type="date" value={f.date || ""} onChange={(e) => updateFlight(f.id, { date: e.target.value })} />
              <input type="time" value={f.time || ""} onChange={(e) => updateFlight(f.id, { time: e.target.value })} />
              <select value={f.direction || "outbound"} onChange={(e) => updateFlight(f.id, { direction: e.target.value })}>
                <option value="outbound">{s.flightOutbound}</option>
                <option value="return">{s.flightReturn}</option>
                <option value="internal">{s.flightInternal}</option>
              </select>
              <button className="danger" onClick={() => removeFlight(f.id)}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addFlight}>+ {s.addFlight}</button>
          {(experience.flights || []).length > 0 && pushSupported && (
            <button
              type="button"
              className="flightAlertsBtn"
              disabled={flightAlertsState === "asking" || !!experience.organizerPushToken}
              onClick={async () => {
                if (!experience.id) return alert(he ? "שמרו את החוויה קודם." : "Save the experience first.");
                setFlightAlertsState("asking");
                try {
                  await enableOrganizerPushNotifications(experience.id);
                  setExperience({ ...experience, organizerPushToken: true });
                  setFlightAlertsState("on");
                } catch (e) {
                  alert(e.message);
                  setFlightAlertsState("idle");
                }
              }}
            >
              {experience.organizerPushToken
                ? (he ? "🔔 התראות טיסה פעילות" : "🔔 Flight alerts on")
                : flightAlertsState === "asking"
                  ? "…"
                  : (he ? "🔔 קבלת התראות על שינויים בטיסות" : "🔔 Get notified about flight changes")}
            </button>
          )}
        </div>

        <div className="familyPuzzleBox">
          <div className="tag">{s.familyPuzzleTag}</div>
          <p className="rosterHint">{s.familyPuzzleHint}</p>
          {!experience.id&&<p className="quizNoCorrect">⚠ {he?"שמרו את החוויה כדי להעלות תמונה (החוויה עדיין לא קיבלה מזהה).":"Save the experience first to upload a photo (it doesn't have an ID yet)."}</p>}
          <label className="familyPuzzleUpload">{puzzlePhotoSaving?s.saving:experience.familyPuzzle?.url?s.familyPuzzleReplace:s.familyPuzzleUpload}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!experience.id||puzzlePhotoSaving} onChange={async e=>{
              const file=e.target.files?.[0];if(!file)return;
              setPuzzlePhotoPreview(URL.createObjectURL(file));
              setPuzzlePhotoSaving(true);setPuzzlePhotoError("");
              try{await uploadFamilyPhoto(experience.id,file)}catch(err){setPuzzlePhotoError(err.message)}finally{setPuzzlePhotoSaving(false);e.target.value=""}
            }}/>
          </label>
          {puzzlePhotoPreview&&!experience.familyPuzzle?.url&&<div className="celebrationCartoonPreview">
            <img src={puzzlePhotoPreview} alt={s.familyPuzzleTag}/>
          </div>}
          {puzzlePhotoError&&<p className="quizNoCorrect">⚠ {puzzlePhotoError}</p>}
          {experience.familyPuzzle?.url&&(()=>{
            const total=experience.familyPuzzle.totalPieces||8,cols=4,rows=Math.ceil(total/cols);
            return <div className="celebrationCartoonBox">
              <div className="familyPuzzleGrid studioPuzzlePreview" style={{gridTemplateColumns:`repeat(${cols},1fr)`,aspectRatio:`${cols}/${rows}`}}>
                {Array.from({length:total},(_,gridIdx)=>gridIdx).map(gridIdx=>{
                  const n=pieceAtGridIndex(experience.familyPuzzle.layout,total,gridIdx);
                  const col=gridIdx%cols,row=Math.floor(gridIdx/cols);
                  return <div className="puzzleTile" key={gridIdx}>
                    <div className="puzzleTileImage" style={{backgroundImage:`url(${experience.familyPuzzle.url})`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${cols>1?col/(cols-1)*100:0}% ${rows>1?row/(rows-1)*100:0}%`}}/>
                    <span className="puzzlePieceNumber">{n}</span>
                  </div>;
                })}
              </div>
              <button type="button" disabled={puzzleShuffling} onClick={async()=>{
                setPuzzleShuffling(true);setPuzzleShuffleError("");
                try{await reshuffleFamilyPuzzleLayout(experience.id,total)}catch(err){setPuzzleShuffleError(err.message)}finally{setPuzzleShuffling(false)}
              }}>{puzzleShuffling?s.saving:s.shufflePuzzleBtn}</button>
              <button type="button" disabled={puzzleRemoving} onClick={async()=>{
                setPuzzleRemoving(true);setPuzzleShuffleError("");
                try{await removeFamilyPuzzle(experience.id);setPuzzlePhotoPreview(null)}catch(err){setPuzzleShuffleError(err.message)}finally{setPuzzleRemoving(false)}
              }}>{puzzleRemoving?s.saving:s.familyPuzzleRemove}</button>
              {puzzleShuffleError&&<p className="quizNoCorrect">⚠ {puzzleShuffleError}</p>}
            </div>;
          })()}
        </div>

        <p className="contextHint">{he?"בחרו תחנה קיימת מהרשימה כדי לערוך אותה, או הוסיפו משימה חדשה מהאפשרויות הבאות.":"Select a stop below to edit it, or add a new mission using these options."}</p>
        <div className="atomBar">
          {["photo", "video", "map", "quiz", "puzzle", "note", "reward", "story", "branch"].map(
            (type) => (
              <button key={type} onClick={() => add(type)}>
                ＋ {labels[type]}
              </button>
            )
          )}
        </div>

        {firebaseConfigured && flow.length > 0 && (
          <div className="reviseBar">
            <input
              placeholder={s.revisePlaceholder}
              value={revisePrompt}
              onChange={(e) => setRevisePrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reviseWithAI()}
              disabled={revising}
            />
            <button disabled={revising || !revisePrompt.trim()} onClick={reviseWithAI}>
              {revising ? s.revising : s.revise}
            </button>
          </div>
        )}

        <div className="flow">
          {!flow.length && (
            <div className="emptyBuilder">
              <b>{s.emptyTitle}</b>
              <span>{s.emptySub}</span>
            </div>
          )}

          {flow.map((item, index) => (
            <div key={item.id} className="flowWrap">
              <button
                className={
                  "flowNode " + (item.id === selected ? "selected" : "")
                }
                onClick={() => setSelected(item.id)}
              >
                <small>{labels[item.type]||item.type}</small>
                <b>{item.title}</b>
                <span>{item.text ? (item.text.length > 90 ? item.text.slice(0, 90) + "…" : item.text) : s.noInstructionYet}</span>
              </button>

              {index < flow.length - 1 && (
                <div className="connector">→</div>
              )}
            </div>
          ))}
        </div>

        {atom && (
          <div className="inspector" ref={inspectorRef}>
            <label>{s.title}</label>
            <input
              ref={titleInputRef}
              value={atom.title || ""}
              onChange={(e) => patch({ title: e.target.value })}
            />

            <label>{s.instruction}</label>
            <textarea
              value={atom.text || ""}
              onChange={(e) => patch({ text: e.target.value })}
            />

            <div className="fieldRow">
              <div>
                <label>{s.dayLabel}</label>
                <input
                  type="number" min="1"
                  value={atom.day || ""}
                  placeholder={s.dayPlaceholder}
                  onChange={(e) => patch({ day: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <label>{s.dateLabel}</label>
                <input
                  type="date"
                  value={atom.date || ""}
                  onChange={(e) => patch({ date: e.target.value || null })}
                />
              </div>
            </div>
            <label>{s.hotelLabel}</label>
            <input
              value={atom.hotel || ""}
              placeholder={s.hotelPlaceholder}
              onChange={(e) => patch({ hotel: e.target.value })}
            />

            {atom.type === "puzzle" && (
              <>
                <label>{s.puzzleAnswer}</label>
                <input
                  value={atom.answer || ""}
                  placeholder={s.puzzleAnswerPlaceholder}
                  onChange={(e) => patch({ answer: e.target.value })}
                />
              </>
            )}

            {["quiz","puzzle","note"].includes(atom.type) && <div className="answerModeEditor"><label>{experience.lang==="he"?"אופן המענה":"Answer mode"}</label><select value={atom.type==="note"||atom.responseMode==="open"?"open":"graded"} onChange={e=>patch(e.target.value==="open"?{type:"note",responseMode:"open",answer:"",options:[]}:{type:"puzzle",responseMode:"graded",answer:""})}><option value="open">{experience.lang==="he"?"שאלה פתוחה — כל תשובה אישית מתקבלת":"Open question — any personal answer"}</option><option value="graded">{experience.lang==="he"?"חידה — תשובה נכונה מוגדרת":"Riddle — a specific correct answer"}</option></select>{missionAnswers.normalizeMission(atom).type!==atom.type&&<p role="status">{experience.lang==="he"?"השאלה מזוהה כשאלה פתוחה ותוצג כך למשתתפים. אפשר לשמור זאת באמצעות הבחירה למעלה.":"This question is treated as open for participants. Use the selector to save that mode."}</p>}{missionAnswers.normalizeMission(atom).needsAnswerReview&&<p role="status">{experience.lang==="he"?"יש להשלים אפשרויות מילוליות ותשובה נכונה. עד אז לא תוצג בחירה באותיות.":"Add meaningful choices and a correct answer. Letter-only choices will not be shown."}</p>}</div>}

            {atom.type === "quiz" && (
              <div className="quizEditor">
                <label>{s.quizOptionsLabel}</label>
                {(atom.options || []).map((opt, i) => (
                  <div className="quizOptionRow" key={i}>
                    <input
                      type="radio"
                      name="quizCorrectOption"
                      checked={!!opt && atom.answer === opt}
                      onChange={() => setQuizCorrect(i)}
                    />
                    <input
                      value={opt}
                      placeholder={s.quizOptionPlaceholder}
                      onChange={(e) => updateQuizOption(i, e.target.value)}
                    />
                    <button type="button" className="danger" onClick={() => removeQuizOption(i)}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={addQuizOption}>+ {s.quizAddOption}</button>
                {!atom.answer && <p className="quizNoCorrect">⚠ {s.quizPickCorrect}</p>}
              </div>
            )}

            {atom.type === "branch" && (
              <div className="branchEditor">
                <label className="organizerDecidesCheck">
                  <input
                    type="checkbox"
                    checked={!!atom.organizerDecides}
                    onChange={(e) => patch({ organizerDecides: e.target.checked })}
                  />
                  {s.organizerDecidesLabel}
                </label>
                {atom.organizerDecides && <p className="organizerDecidesHint">{s.organizerDecidesHint}</p>}
                <label>{s.branchOptionsLabel}</label>
                {(atom.options || []).map((o) => (
                  <div className="branchOptionRow" key={o.id}>
                    <input
                      value={o.label || ""}
                      placeholder={s.branchOptionPlaceholder}
                      onChange={(e) => updateBranchOption(o.id, { label: e.target.value })}
                    />
                    <select
                      value={o.next || ""}
                      onChange={(e) => updateBranchOption(o.id, { next: e.target.value })}
                    >
                      <option value="">{s.branchEndJourney}</option>
                      {flow.filter((m) => m.id !== atom.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.title || m.type}</option>
                      ))}
                    </select>
                    <button type="button" className="danger" onClick={() => removeBranchOption(o.id)}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={addBranchOption}>+ {s.branchAddOption}</button>
              </div>
            )}

            {atom.type === "story" && Array.isArray(atom.options) && atom.options.length > 0 && (
              <div className="linkOptionsEditor">
                <label>{he?"אפשרויות (שם, סיבה וקישור)":"Options (name, reason & link)"}</label>
                <p className="linkOptionsHint">{he?"אפשר לערוך את השמות, ההמלצות והקישורים האלה בכל שלב — גם אחרי הפרסום.":"You can edit these names, recommendations and links at any time — including after publishing."}</p>
                {atom.options.map((o) => (
                  <div className="linkOptionRow" key={o.id}>
                    <input
                      value={o.name || ""}
                      placeholder={he?"שם":"Name"}
                      onChange={(e) => updateLinkOption(o.id, { name: e.target.value })}
                    />
                    <input
                      value={o.why || ""}
                      placeholder={he?"למה זה מתאים":"Why it fits"}
                      onChange={(e) => updateLinkOption(o.id, { why: e.target.value })}
                    />
                    <input
                      dir="ltr"
                      value={o.url || ""}
                      placeholder={he?"קישור":"Link URL"}
                      onChange={(e) => updateLinkOption(o.id, { url: e.target.value })}
                    />
                    <button type="button" className="danger" onClick={() => removeLinkOption(o.id)}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={addLinkOption}>+ {he?"הוספת אפשרות":"Add option"}</button>
              </div>
            )}

            {atom.type === "map" && (()=>{
              const hasGps = Number.isFinite(atom.lat) && Number.isFinite(atom.lng);
              return <>
              <div className="gpsCheckpoint">
                <label>{s.gpsCheckpoint}</label>
                {hasGps ? (
                  <p className="gpsStatus">
                    {s.gpsSetAt} {atom.lat.toFixed(5)}, {atom.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="gpsStatus">{s.gpsNotSet}</p>
                )}
                <div className="fieldRow">
                  <div>
                    <label>{s.addressLabel}</label>
                    <input
                      value={addressInput}
                      placeholder={s.addressPlaceholder}
                      onChange={(e) => setAddressInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && findByAddress()}
                    />
                  </div>
                  <div>
                    <button type="button" disabled={geocoding || !addressInput.trim()} onClick={findByAddress}>
                      {geocoding ? s.locating : s.findByAddress}
                    </button>
                  </div>
                </div>
                {geocodeError && <p className="quizNoCorrect">⚠ {geocodeError}</p>}
                <div className="fieldRow">
                  <div>
                    <button type="button" disabled={locating} onClick={setCheckpointHere}>
                      {locating ? s.locating : s.useMyLocation}
                    </button>
                  </div>
                  <div>
                    <label>{s.radius}</label>
                    <input
                      type="number"
                      value={atom.radius || 150}
                      onChange={(e) => patch({ radius: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="qrCheckpoint">
                <label>{s.qrCheckpoint}</label>
                {!hasGps && <p className="gpsStatus">{s.qrNeedsGpsFirst}</p>}
                <div className="fieldRow">
                  <div>
                    <button type="button" disabled={!hasGps} onClick={generateQr}>{s.generateQr}</button>
                  </div>
                </div>
                {hasGps && atom.qrCode && qrImgUrl && (
                  <>
                    <p className="gpsStatus">{s.qrNavHint}</p>
                    <div className="qrPreviewWrap">
                      <img className="qrPreview" src={qrImgUrl} alt="QR code" />
                      <a href={qrImgUrl} download={`morivo-checkpoint-${atom.id}.png`}>{s.downloadQr}</a>
                    </div>
                  </>
                )}
              </div>
              </>;
            })()}

            <label className="organizerDecidesCheck">
              <input
                type="checkbox"
                checked={!!atom.stamp}
                onChange={(e) => patch({ stamp: e.target.checked })}
              />
              {s.stampMissionLabel}
            </label>
            <p className="organizerDecidesHint">{s.stampMissionHint}</p>

            {experience.familyPuzzle?.url && (
              <>
                <label>{s.puzzlePieceLabel}</label>
                <input
                  type="number"
                  min="1"
                  max={experience.familyPuzzle.totalPieces || 8}
                  value={atom.puzzlePiece || ""}
                  placeholder={s.puzzlePiecePlaceholder}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    patch({ puzzlePiece: v === "" ? null : Math.max(1, Math.min(experience.familyPuzzle.totalPieces || 8, Number(v) || 1)) });
                  }}
                />
              </>
            )}

            <label>{s.reward}</label>
            <input
              value={atom.reward || ""}
              onChange={(e) => patch({ reward: e.target.value })}
            />

            <label>{s.points}</label>
            <input
              type="number"
              min="0"
              max="500"
              value={atom.points || 100}
              onChange={(e) => patch({ points: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })}
            />

            <div className="actions">
              <button onClick={() => move(-1)}>↑ {s.move}</button>
              <button onClick={() => move(1)}>↓ {s.move}</button>
              <button onClick={duplicate}>{s.duplicate}</button>
              <button onClick={remove}>{s.delete}</button>
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={() => setView("dashboard")}>{s.dashboardBtn}</button>
          <button onClick={() => setView("runtime")}>{s.runtimeBtn}</button>
          <button id="publish-experience" className="primary" disabled={publishing||saving||saveError||!flow.length} onClick={()=>experience.status==="live"&&experience.joinCode?setView("runtime"):publish()}>
            {publishing ? s.publishing : experience.status==="live"&&experience.joinCode?(he?"שיתוף וניהול החוויה":"Share & manage experience"):s.publish}
          </button>
        </div>
        <p className="contextHint">{saving?(he?"ממתינים לסיום השמירה לפני הפרסום.":"Wait for changes to save before publishing."):saveError?(he?"השמירה נכשלה. תקנו או שמרו שוב לפני הפרסום.":"Saving failed. Save your changes successfully before publishing."):!flow.length?(he?"הוסיפו לפחות משימה אחת כדי לפרסם.":"Add at least one mission to publish."):experience.status==="live"?(he?"החוויה פעילה. השינויים נשמרים ומתעדכנים אצל המשתתפים מיד.":"This experience is live. Saved changes update for participants immediately."):he?"הפרסום ייצור קישור וקוד הצטרפות. אפשר להמשיך לערוך גם אחרי הפרסום.":"Publishing creates a join link and code. You can keep editing after publishing."}</p>
      </div>

      <div className="panel studioPreviewPanel">
        <p className="contextHint">{he?"תצוגה מקדימה בלבד — כך ייראה תוכן התחנה. כדי להשתתף בפועל, פתחו את קישור ההצטרפות אחרי הפרסום.":"Preview only — this shows the stop's content. To participate, open the join link after publishing."}</p>
        <div className="previewHeader"><div><div className="tag">{s.liveParticipantPreview}</div><span>LIVE EXPERIENCE</span></div><i></i></div>

        {atom ? (
          <div className="phone">
            <h3>{atom.title}</h3>
            <p>{atom.text ? <LinkifiedText text={atom.text} /> : s.instructionPlaceholder}</p>

            {atom.type === "branch" ? (
              <div className="branchChoices">
                {(atom.options || []).map((o) => (
                  <button key={o.id} type="button" className="branchChoiceBtn" disabled>
                    {o.label || s.branchOptionPlaceholder}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {atom.type === "quiz" && (
                  <div className="choiceGrid">
                    {(atom.options && atom.options.length ? atom.options : [s.quizOptionPlaceholder]).map((opt, i) => (
                      <button key={i} type="button" className={opt && atom.answer === opt ? "selected" : ""} disabled>
                        {opt || s.quizOptionPlaceholder}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mission">
                  {atom.reward
                    ? `${s.rewardPrefix} ${atom.reward}`
                    : `${atom.points || 100} ${s.pointsSuffix}`}
                </div>

                <button className="primary" disabled>{s.completeMission}</button>
              </>
            )}
          </div>
        ) : (
          <div className="emptyBuilder">
            <b>{s.noMissionSelected}</b>
            <span>{s.addMissionToSee}</span>
          </div>
        )}
      </div>
    </section>
  );
}
