/**
 * Synchronous hardware probe. Pairs with device-profile.js.
 * Adds screen/pixel/aspect details not already captured there.
 */

export function collectHardwareExtra() {
  const nav = navigator;
  const dpr = window.devicePixelRatio || 1;
  return {
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: dpr,
      physicalWidth: Math.round(screen.width * dpr),
      physicalHeight: Math.round(screen.height * dpr),
      orientation: screen.orientation?.type || null,
      angle: screen.orientation?.angle ?? null,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      aspectRatio: (screen.width / (screen.height || 1)).toFixed(3),
    },
    cpu: {
      cores: nav.hardwareConcurrency ?? null,
      memoryGb: nav.deviceMemory ?? null,
    },
    build: {
      platform: nav.platform || null,
      vendor: nav.vendor || null,
      product: nav.product || null,
      cookieEnabled: nav.cookieEnabled ?? null,
      pdfViewer: nav.pdfViewerEnabled ?? null,
    },
    timezone: {
      intlZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offsetMinutes: new Date().getTimezoneOffset(),
      offsetString: formatOffset(new Date().getTimezoneOffset()),
      calendar: Intl.DateTimeFormat().resolvedOptions().calendar,
      numberingSystem: Intl.DateTimeFormat().resolvedOptions().numberingSystem,
    },
  };
}

function formatOffset(mins) {
  const sign = mins > 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

export async function collectAsyncHardwareExtra() {
  const out = {};

  // Battery (Chromium only, iOS/Safari absent)
  if (navigator.getBattery) {
    try {
      const b = await navigator.getBattery();
      out.battery = {
        level: Math.round(b.level * 100),
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      };
    } catch {
      out.battery = null;
    }
  }

  // Storage estimate
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      out.storage = {
        quotaMb: est.quota ? Math.round(est.quota / 1024 / 1024) : null,
        usageMb: est.usage ? Math.round(est.usage / 1024 / 1024) : null,
      };
    } catch {
      out.storage = null;
    }
  }

  // Media device counts (only types, no labels until permission)
  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      out.media = {
        audioIn: devices.filter((d) => d.kind === "audioinput").length,
        videoIn: devices.filter((d) => d.kind === "videoinput").length,
        audioOut: devices.filter((d) => d.kind === "audiooutput").length,
      };
    } catch {
      out.media = null;
    }
  }

  // Network Information API
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  out.network = conn
    ? {
        type: conn.type || null,
        effectiveType: conn.effectiveType || null,
        downlink: conn.downlink ?? null,
        downlinkMax: conn.downlinkMax ?? null,
        rtt: conn.rtt ?? null,
        saveData: conn.saveData ?? null,
      }
    : null;

  return out;
}
