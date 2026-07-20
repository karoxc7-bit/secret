function parseUserAgent(ua) {
  const s = ua || "";
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(s);
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));

  let os = "Unknown";
  let osVersion = null;
  let m;
  if (/Windows NT 10/.test(s)) {
    os = "Windows";
    osVersion = "10/11";
  } else if (/Windows NT 6.3/.test(s)) {
    os = "Windows";
    osVersion = "8.1";
  } else if ((m = s.match(/Mac OS X ([\d_]+)/))) {
    os = "macOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if ((m = s.match(/Android ([\d.]+)/))) {
    os = "Android";
    osVersion = m[1];
  } else if ((m = s.match(/iPhone OS ([\d_]+)/)) || (m = s.match(/CPU OS ([\d_]+)/))) {
    os = "iOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if (/Linux/.test(s)) {
    os = "Linux";
  }

  let browser = "Unknown";
  let browserVersion = null;
  if ((m = s.match(/Edg\/([\d.]+)/))) {
    browser = "Edge";
    browserVersion = m[1];
  } else if ((m = s.match(/OPR\/([\d.]+)/))) {
    browser = "Opera";
    browserVersion = m[1];
  } else if ((m = s.match(/Chrome\/([\d.]+)/)) && !/Edg|OPR/.test(s)) {
    browser = "Chrome";
    browserVersion = m[1];
  } else if ((m = s.match(/Version\/([\d.]+).*Safari/))) {
    browser = "Safari";
    browserVersion = m[1];
  } else if ((m = s.match(/Firefox\/([\d.]+)/))) {
    browser = "Firefox";
    browserVersion = m[1];
  } else if ((m = s.match(/SamsungBrowser\/([\d.]+)/))) {
    browser = "Samsung Internet";
    browserVersion = m[1];
  }

  let deviceType = "desktop";
  if (tablet) deviceType = "tablet";
  else if (mobile) deviceType = "mobile";

  return { deviceType, os, osVersion, browser, browserVersion };
}

function getWebGLInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      version: gl.getParameter(gl.VERSION),
      shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    };
  } catch {
    return null;
  }
}

function storageAvailable(type) {
  try {
    const key = "__t";
    window[type].setItem(key, "1");
    window[type].removeItem(key);
    return true;
  } catch {
    return false;
  }
}

async function queryPermission(name) {
  if (!navigator.permissions?.query) return null;
  try {
    const result = await navigator.permissions.query({ name });
    return result.state;
  } catch {
    return null;
  }
}

async function getClientHints() {
  const uad = navigator.userAgentData;
  if (!uad?.getHighEntropyValues) return null;
  try {
    return await uad.getHighEntropyValues([
      "architecture",
      "bitness",
      "model",
      "platform",
      "platformVersion",
      "fullVersionList",
      "wow64",
      "mobile",
    ]);
  } catch {
    return null;
  }
}

async function getBatteryInfo() {
  if (!navigator.getBattery) return null;
  try {
    const b = await navigator.getBattery();
    return {
      level: Math.round(b.level * 100),
      charging: b.charging,
      chargingTime: b.chargingTime,
      dischargingTime: b.dischargingTime,
    };
  } catch {
    return null;
  }
}

async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    return {
      quotaMb: est.quota ? Math.round(est.quota / 1024 / 1024) : null,
      usageMb: est.usage ? Math.round(est.usage / 1024 / 1024) : null,
    };
  } catch {
    return null;
  }
}

async function getMediaDeviceCounts() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { audioIn: null, videoIn: null, audioOut: null };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      audioIn: devices.filter((d) => d.kind === "audioinput").length,
      videoIn: devices.filter((d) => d.kind === "videoinput").length,
      audioOut: devices.filter((d) => d.kind === "audiooutput").length,
    };
  } catch {
    return { audioIn: null, videoIn: null, audioOut: null };
  }
}

export async function collectDeviceProfile(extra = {}) {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const ua = nav.userAgent || "";
  const parsed = parseUserAgent(ua);
  const intl = Intl.DateTimeFormat().resolvedOptions();

  const [
    clientHints,
    battery,
    storage,
    mediaCounts,
    permGeo,
    permCamera,
    permNotif,
  ] = await Promise.all([
    getClientHints(),
    getBatteryInfo(),
    getStorageEstimate(),
    getMediaDeviceCounts(),
    queryPermission("geolocation"),
    queryPermission("camera"),
    queryPermission("notifications"),
  ]);

  const model =
    clientHints?.model ||
    (/iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : null);

  return {
    schemaVersion: 2,
    collectedAt: new Date().toISOString(),
    summary: {
      deviceType: parsed.deviceType,
      os: parsed.os,
      osVersion: parsed.osVersion,
      browser: parsed.browser,
      browserVersion: parsed.browserVersion,
      model: model || null,
      label: [
        parsed.deviceType,
        model || parsed.os,
        parsed.browser,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    userAgent: ua,
    platform: nav.platform || null,
    vendor: nav.vendor || null,
    brands: clientHints?.brands || nav.userAgentData?.brands || null,
    clientHints,
    display: {
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
      },
      orientation: screen.orientation?.type || null,
      angle: screen.orientation?.angle ?? null,
      pixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      prefersColorScheme: window.matchMedia?.("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light",
      prefersReducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches,
    },
    hardware: {
      cpuCores: nav.hardwareConcurrency ?? null,
      deviceMemoryGb: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      gpu: getWebGLInfo(),
    },
    locale: {
      language: nav.language,
      languages: nav.languages ? [...nav.languages] : [],
      timezone: intl.timeZone,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      calendar: intl.calendar,
      numberingSystem: intl.numberingSystem,
    },
    connectivity: {
      online: nav.onLine,
      effectiveType: conn?.effectiveType ?? null,
      downlinkMbps: conn?.downlink ?? null,
      rttMs: conn?.rtt ?? null,
      saveData: conn?.saveData ?? null,
      type: conn?.type ?? null,
    },
    capabilities: {
      cookieEnabled: nav.cookieEnabled,
      localStorage: storageAvailable("localStorage"),
      sessionStorage: storageAvailable("sessionStorage"),
      pdfViewer: nav.pdfViewerEnabled ?? null,
      standalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        nav.standalone === true,
    },
    permissions: {
      geolocation: permGeo,
      camera: permCamera,
      notifications: permNotif,
    },
    mediaDevices: mediaCounts,
    battery,
    storage,
    flags: {
      webdriver: !!nav.webdriver,
      touchCapable: (nav.maxTouchPoints ?? 0) > 0,
    },
    network: {
      ipGeo: extra.ipGeo || null,
    },
  };
}

/** @deprecated use collectDeviceProfile */
export function getDeviceInfo() {
  const nav = navigator;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
  };
}
