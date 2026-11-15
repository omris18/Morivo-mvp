"use client";
import { useEffect, useState } from "react";
import Studio from "../../components/Studio";
import Memory from "../../components/Memory";
import Sidebar from "../../components/Sidebar";
import { STRINGS, getDir } from "../../lib/i18n";
import { sample } from "./sample";

export default function Harness() {
  const [ready, setReady] = useState(false);
  const [experience, setExperience] = useState(sample.experience);
  const [q, setQ] = useState({ view: "memory", lang: "en" });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    window.__SAMPLE__ = sample;
    setQ({ view: p.get("view") || "memory", lang: p.get("lang") || "en" });
    setReady(true);
  }, []);
  if (!ready) return null;
  const t = STRINGS[q.lang] || STRINGS.en, dir = getDir(q.lang);
  const props = { experience, setExperience, setView: () => {}, t, lang: q.lang, dir, user: { uid: "owner" }, isMaster: false };
  return <div className="appShell" dir={dir}>
    <Sidebar view={q.view} setView={() => {}} t={t} lang={q.lang} />
    <main className="content">
      {q.view === "studio" ? <Studio {...props} /> : <Memory {...props} />}
    </main>
  </div>;
}
