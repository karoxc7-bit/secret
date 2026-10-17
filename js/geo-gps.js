/**
 * Multi-tier geolocation. Low-accuracy pass first, then a high-accuracy pass.
 * On iOS Safari and Android Chrome this yields 3–50 m when the user grants.
 * Windows Chrome/Edge typically 20–200 m via WiFi/cell.
 */

function getOnce(options) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    const timer = setTimeout(
      () => resolve({ ok: false, reason: "timeout" }),
      (options.timeout || 6000) + 1500
    );
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({
          ok: true,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          altitudeAccuracy: p.coords.altitudeAccuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
          timestamp: p.timestamp,
        });
      },
      (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          reason: err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "error",
          message: err.message || null,
        });
      },
      options
    );
  });
}

export function requestGpsLow() {
  return getOnce({
    enableHighAccuracy: false,
    timeout: 6000,
    maximumAge: 300000,
  });
}

export function requestGpsHigh() {
  return getOnce({
    enableHighAccuracy: true,
    timeout: 9000,
    maximumAge: 0,
  });
}

/**
 * Best-effort: try low accuracy first, upgrade to high accuracy if needed.
 * Returns { ok, latitude, longitude, accuracy, tier: "gps" | "gps_hd", ... }.
 */
export async function requestBestGps() {
  const low = await requestGpsLow();
  if (!low.ok) return low;
  if (low.accuracy != null && low.accuracy <= 100) {
    return { ...low, tier: "gps" };
  }
  const high = await requestGpsHigh();
  if (high.ok && (high.accuracy == null || high.accuracy < low.accuracy)) {
    return { ...high, tier: "gps_hd" };
  }
  return { ...low, tier: "gps" };
}

/**
 * Also expose a permission probe that does not trigger a prompt.
 */
export async function probeGeoPermission() {
  if (!navigator.permissions?.query) return null;
  try {
    const r = await navigator.permissions.query({ name: "geolocation" });
    return r.state; // "granted" | "denied" | "prompt"
  } catch {
    return null;
  }
}
