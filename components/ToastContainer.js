"use client";
import { useEffect, useState } from "react";
import { subscribeToast } from "../lib/toast";

const AUTO_DISMISS_MS = { error: 7000, success: 4500, info: 5000 };

// Mounted once at the app root (app/page.js) so a toast fired from anywhere - a failed upload in
// Participant.js, a save error in Studio.js - renders above whatever screen is active, replacing
// the native alert() dialogs that used to interrupt the flow with a browser-chrome popup instead
// of something that matches the rest of the app.
export default function ToastContainer({ dir }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((list) => [...list, toast]);
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS[toast.type] || AUTO_DISMISS_MS.info);
    });
  }, []);

  function dismiss(id) {
    setToasts((list) => list.filter((t) => t.id !== id));
  }

  if (!toasts.length) return null;
  return (
    <div className="toastStack" dir={dir} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toastIcon" aria-hidden="true">{t.type === "error" ? "⚠" : t.type === "success" ? "✓" : "ℹ"}</span>
          <span className="toastMessage">{t.message}</span>
          <button type="button" className="toastClose" onClick={() => dismiss(t.id)} aria-label={dir === "rtl" ? "סגירה" : "Close"}>×</button>
        </div>
      ))}
    </div>
  );
}
