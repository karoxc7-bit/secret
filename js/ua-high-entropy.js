/**
 * High-entropy user agent hints + hardware probe.
 * Covers Windows, Android (Chrome), iOS (Safari fallback to UA parsing).
 */

const UA_BRANDS = [
  { brand: "Chromium", v: 1 },
  { brand: "Google Chrome", v: 1 },
  { brand: "Microsoft Edge", v: 1 },
];

function parseIos(ua) {
  const m = ua.match(/(iPhone|iPad|iPod).*?OS ([\d_]+)/) || ua.match(/CPU OS ([\d_]+)/);
  return {
    os: "iOS",
    osVersion: m ? m[2].replace(/_/g, ".") : null,
    model: /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /iPhone/.test(ua)
        ? "iPhone"
        : /iPod/.test(ua)
          ? "iPod"
          : null,
  };
}

function parseAndroid(ua) {
  const m = ua.match(/Android\s+([\d.]+)[^;]*;\s*([^;)]+?)(?:\s+Build|\))/i);
  return {
    os: "Android",
    osVersion: m ? m[1] : null,
    model: m ? m[2].trim().replace(/\s+/g, " ") : null,
  };
}

function parseWindows(uad) {
  const pv = uad?.platformVersion;
  // Chromium: Win10 = "10.0.0", Win11 = "13.0.0" and above
  if (pv) {
    const major = parseInt(pv.split(".")[0], 10);
    return {
      os: "Windows",
      osVersion: major >= 13 ? "11" : major >= 10 ? "10" : pv,
      model: null,
    };
  }
  return { os: "Windows", osVersion: null, model: null };
}

export async function collectHighEntropy() {
  const uad = navigator.userAgentData;
  const ua = navigator.userAgent || "";

  let high = null;
  if (uad?.getHighEntropyValues) {
    try {
      high = await uad.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platform",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
        "wow64",
        "formFactors",
      ]);
    } catch {
      high = null;
    }
  }

  let parsed;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    parsed = parseIos(ua);
  } else if (/Android/i.test(ua)) {
    parsed = parseAndroid(ua);
  } else if (/Windows/i.test(ua) || /Win64|WOW64/i.test(ua)) {
    parsed = parseWindows(uad);
  } else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    parsed = { os: "macOS", osVersion: m ? m[1].replace(/_/g, ".") : null, model: null };
  } else if (/CrOS/.test(ua)) {
    const m = ua.match(/CrOS \w+ ([\d.]+)/);
    parsed = { os: "ChromeOS", osVersion: m ? m[1] : null, model: null };
  } else {
    parsed = { os: /Linux/.test(ua) ? "Linux" : "Unknown", osVersion: null, model: null };
  }

  return {
    supported: !!high,
    brands: uad?.brands || UA_BRANDS,
    mobile: uad?.mobile ?? /Mobi|Android|iPhone/i.test(ua),
    platform: parsed.os,
    platformVersion: parsed.osVersion,
    model: (high && high.model) || parsed.model,
    architecture: high?.architecture || null,
    bitness: high?.bitness || null,
    wow64: high?.wow64 ?? null,
    uaFullVersion: high?.uaFullVersion || null,
    fullVersionList: high?.fullVersionList || null,
    formFactors: high?.formFactors || null,
  };
}
