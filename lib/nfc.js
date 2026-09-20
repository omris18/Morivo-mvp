"use client";
import { Capacitor } from "@capacitor/core";

function buildUriRecord(url) {
  let code = 0x00, rest = url;
  if (url.startsWith("https://")) { code = 0x04; rest = url.slice(8); }
  else if (url.startsWith("http://")) { code = 0x03; rest = url.slice(7); }
  const payload = [code, ...Array.from(new TextEncoder().encode(rest))];
  return { tnf: 1, type: [0x55], id: [], payload };
}

export function nfcWriteSupported() {
  return Capacitor.isNativePlatform() || (typeof window !== "undefined" && "NDEFReader" in window);
}

// Writes a URL onto the next NFC tag the device touches. onStatus receives
// "waiting" (hold the tag against the phone) then "writing".
export async function writeNfcTag(url, { onStatus } = {}) {
  if (Capacitor.isNativePlatform()) return writeNfcTagNative(url, onStatus);
  if (typeof window !== "undefined" && "NDEFReader" in window) return writeNfcTagWeb(url, onStatus);
  throw new Error("NFC writing isn't supported here. Use Chrome on Android, or the installed app on an NFC-capable phone.");
}

async function writeNfcTagNative(url, onStatus) {
  const { CapacitorNfc } = await import("@capgo/capacitor-nfc");
  onStatus?.("waiting");
  let handle;
  try {
    const tagPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for a tag - hold the blank tag against the back of the phone and try again.")), 30000);
      CapacitorNfc.addListener("tagDiscovered", () => { clearTimeout(timeout); resolve(); })
        .then((h) => { handle = h; });
    });
    await CapacitorNfc.startScanning();
    await tagPromise;
    onStatus?.("writing");
    await CapacitorNfc.write({ records: [buildUriRecord(url)] });
  } finally {
    handle?.remove();
    CapacitorNfc.stopScanning().catch(() => {});
  }
}

async function writeNfcTagWeb(url, onStatus) {
  onStatus?.("waiting");
  const writer = new window.NDEFReader();
  onStatus?.("writing");
  await writer.write({ records: [{ recordType: "url", data: url }] });
}
