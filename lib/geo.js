export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  let res;
  try { res = await fetch(url, { headers: { Accept: "application/json" } }); }
  catch { throw new Error("Could not reach the address lookup service. Check your connection and try again."); }
  if (!res.ok) throw new Error("Could not reach the address lookup service. Try again.");
  const results = await res.json();
  if (!results.length) throw new Error("No location found for that address. Try a more specific address.");
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

export function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Could not get your location.")),
      { enableHighAccuracy: true, timeout: 15000, ...options }
    );
  });
}
