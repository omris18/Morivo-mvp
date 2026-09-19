"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { firebaseConfigured, functions } from "../lib/firebase";
import { publishExperienceRemote, updateExperienceRemote } from "../lib/morivoData";
import LinkifiedText from "./LinkifiedText";
import { getCurrentPosition } from "../lib/geo";

export default function Studio({ experience, setExperience, setView, t }) {
  const s = t.studio;
  const flow = experience.flow || [];
  const [selected, setSelected] = useState(flow[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisePrompt, setRevisePrompt] = useState("");

  const atom = flow.find((x) => x.id === selected) || null;

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
      try {
        await updateExperienceRemote(next.id, {
          flow: next.flow,
          name: next.name,
          story: next.story,
          type: next.type,
          location: next.location,
          people: next.people,
        });
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

  async function reviseWithAI() {
    if (!revisePrompt.trim()) return;
    if (!flow.length) return alert(s.addAtLeastOneMission);
    setRevising(true);
    try {
      const revise = httpsCallable(functions, "reviseExperience");
      const result = await revise({ flow, instruction: revisePrompt.trim() });
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
      title: s.newMissionTitle(type),
      text: "",
      reward: `100 ${s.pointsSuffix}`,
      points: 100,
    };

    persist({
      ...experience,
      flow: [...flow, newAtom],
    });

    setSelected(newAtom.id);
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

    const code = await publishExperienceRemote(experience);

    setExperience({
      ...experience,
      status: "live",
      joinCode: code,
    });

    alert(s.published(code));
  }

  return (
    <section className="grid2">
      <div className="panel">
        <div className="tag">
          {s.savingTag} · {saving ? s.saving : s.saved}
        </div>

        <h2>{experience.name || s.untitled}</h2>

        <div className="atomBar">
          {["photo", "video", "map", "quiz", "puzzle", "note", "reward", "story", "nfc"].map(
            (type) => (
              <button key={type} onClick={() => add(type)}>
                ＋ {type}
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
                <small>{item.type}</small>
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
          <div className="inspector">
            <label>{s.title}</label>
            <input
              value={atom.title || ""}
              onChange={(e) => patch({ title: e.target.value })}
            />

            <label>{s.instruction}</label>
            <textarea
              value={atom.text || ""}
              onChange={(e) => patch({ text: e.target.value })}
            />

            {atom.type === "map" && (
              <div className="gpsCheckpoint">
                <label>{s.gpsCheckpoint}</label>
                {Number.isFinite(atom.lat) && Number.isFinite(atom.lng) ? (
                  <p className="gpsStatus">
                    {s.gpsSetAt} {atom.lat.toFixed(5)}, {atom.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="gpsStatus">{s.gpsNotSet}</p>
                )}
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
          <button className="primary" onClick={publish}>
            {s.publish}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="tag">{s.liveParticipantPreview}</div>

        {atom ? (
          <div className="phone">
            <h3>{atom.title}</h3>
            <p>{atom.text ? <LinkifiedText text={atom.text} /> : s.instructionPlaceholder}</p>

            <div className="mission">
              {atom.reward
                ? `${s.rewardPrefix} ${atom.reward}`
                : `${atom.points || 100} ${s.pointsSuffix}`}
            </div>

            <button className="primary">{s.completeMission}</button>
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
