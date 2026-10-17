/**
 * Referrer / UTM / click-ids / first-touch. No permissions.
 */

const FIRST_TOUCH_KEY = "ops_first_touch_v1";

function pickParams(search) {
  const p = new URLSearchParams(search || "");
  const get = (k) => {
    const v = p.get(k);
    return v && v.trim() ? v.trim().slice(0, 256) : null;
  };

  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
    utm_term: get("utm_term"),
    gclid: get("gclid"),
    fbclid: get("fbclid"),
    msclkid: get("msclkid"),
    ttclid: get("ttclid"),
    ref: get("ref"),
  };
}

function snapshot() {
  const params = pickParams(location.search);
  return {
    at: new Date().toISOString(),
    page_url: location.href.slice(0, 2000),
    path: location.pathname,
    referrer: document.referrer ? document.referrer.slice(0, 2000) : null,
    referrer_host: (() => {
      try {
        return document.referrer ? new URL(document.referrer).host : null;
      } catch {
        return null;
      }
    })(),
    ...params,
  };
}

function readFirstTouch() {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeFirstTouch(pack) {
  try {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(pack));
  } catch {
    /* private mode / quota */
  }
}

/** Current hit + first-touch attribution pack. */
export function collectTraffic() {
  const current = snapshot();
  let first = readFirstTouch();
  if (!first) {
    first = { ...current, kind: "first_touch" };
    writeFirstTouch(first);
  }

  return {
    current,
    first_touch: first,
    returning: first.at !== current.at,
  };
}
