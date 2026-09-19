"use client";

import { useEffect, useState } from "react";
import { firebaseConfigured } from "../lib/firebase";
import { publishExperienceRemote, updateExperienceRemote } from "../lib/morivoData";
import LinkifiedText from "./LinkifiedText";
import { getCurrentPosition } from "../lib/geo";

export default function Studio({ experience, setExperience, setView }) {
  const flow = experience.flow || [];
  const [selected, setSelected] = useState(flow[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

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

  function add(type) {
    const newAtom = {
      id: `${type}-${Date.now()}`,
      type,
      title: `New ${type}`,
      text: "",
      reward: "100 points",
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
    if (!window.confirm(`Delete "${atom.title || "this mission"}"? This can't be undone.`)) return;

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
      alert("Add at least one mission before publishing.");
      return;
    }

    if (!firebaseConfigured) {
      setExperience({
        ...experience,
        status: "live",
        joinCode: "MORIVO26",
      });

      alert("Published in demo mode: MORIVO26");
      return;
    }

    const code = await publishExperienceRemote(experience);

    setExperience({
      ...experience,
      status: "live",
      joinCode: code,
    });

    alert(`Published. Join code: ${code}`);
  }

  return (
    <section className="grid2">
      <div className="panel">
        <div className="tag">
          Morivo Studio · {saving ? "Saving…" : "Saved"}
        </div>

        <h2>{experience.name || "Untitled Experience"}</h2>

        <div className="atomBar">
          {["photo", "video", "map", "quiz", "puzzle", "note", "reward", "story", "nfc"].map(
            (type) => (
              <button key={type} onClick={() => add(type)}>
                ＋ {type}
              </button>
            )
          )}
        </div>

        <div className="flow">
          {!flow.length && (
            <div className="emptyBuilder">
              <b>Your journey is empty.</b>
              <span>Add the first mission from the Mission Library above.</span>
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
                <span>{item.text ? (item.text.length > 90 ? item.text.slice(0, 90) + "…" : item.text) : "No participant instruction yet"}</span>
              </button>

              {index < flow.length - 1 && (
                <div className="connector">→</div>
              )}
            </div>
          ))}
        </div>

        {atom && (
          <div className="inspector">
            <label>Title</label>
            <input
              value={atom.title || ""}
              onChange={(e) => patch({ title: e.target.value })}
            />

            <label>Participant instruction</label>
            <textarea
              value={atom.text || ""}
              onChange={(e) => patch({ text: e.target.value })}
            />

            {atom.type === "map" && (
              <div className="gpsCheckpoint">
                <label>GPS checkpoint</label>
                {Number.isFinite(atom.lat) && Number.isFinite(atom.lng) ? (
                  <p className="gpsStatus">
                    📍 Set at {atom.lat.toFixed(5)}, {atom.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="gpsStatus">No location set yet - participants can tap through freely until you set one.</p>
                )}
                <div className="fieldRow">
                  <div>
                    <button type="button" disabled={locating} onClick={setCheckpointHere}>
                      {locating ? "Locating…" : "📍 Use my current location"}
                    </button>
                  </div>
                  <div>
                    <label>Radius (meters)</label>
                    <input
                      type="number"
                      value={atom.radius || 150}
                      onChange={(e) => patch({ radius: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            <label>Reward</label>
            <input
              value={atom.reward || ""}
              onChange={(e) => patch({ reward: e.target.value })}
            />

            <label>Points</label>
            <input
              type="number"
              value={atom.points || 100}
              onChange={(e) => patch({ points: Number(e.target.value) })}
            />

            <div className="actions">
              <button onClick={() => move(-1)}>↑ Move</button>
              <button onClick={() => move(1)}>↓ Move</button>
              <button onClick={duplicate}>⧉ Duplicate</button>
              <button onClick={remove}>Delete</button>
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={() => setView("dashboard")}>Dashboard</button>
          <button onClick={() => setView("runtime")}>Runtime</button>
          <button className="primary" onClick={publish}>
            Publish Experience
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="tag">Live participant preview</div>

        {atom ? (
          <div className="phone">
            <h3>{atom.title}</h3>
            <p>{atom.text ? <LinkifiedText text={atom.text} /> : "Your instruction will appear here."}</p>

            <div className="mission">
              {atom.reward
                ? `Reward: ${atom.reward}`
                : `${atom.points || 100} points`}
            </div>

            <button className="primary">Complete Mission</button>
          </div>
        ) : (
          <div className="emptyBuilder">
            <b>No mission selected.</b>
            <span>Add a mission to see participant preview.</span>
          </div>
        )}
      </div>
    </section>
  );
}
