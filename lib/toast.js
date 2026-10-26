"use client";

// A plain importable function instead of a React context/hook - most of the ~60 alert() calls
// this replaces live in plain async functions (uploads, saves, Firebase calls), not always with
// a convenient hook scope, matching how the rest of this codebase calls shared helpers (e.g.
// lib/morivoData.js) directly rather than through context. components/ToastContainer.js is the
// one place that actually subscribes and renders.
let listeners = [];
let idCounter = 0;

export function showToast(message, type = "error") {
  if (!message) return null;
  const id = ++idCounter;
  const toast = { id, message: String(message), type };
  listeners.forEach((fn) => fn(toast));
  return id;
}

export function subscribeToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}
