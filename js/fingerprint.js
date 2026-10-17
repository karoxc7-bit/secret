/**
 * Canvas + font fingerprint. No permissions required.
 * Works on iOS / Android / Windows / any modern browser.
 * Brave / Firefox resist some channels — the hash is still stable per device.
 */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 32-bit FNV-1a, 8 hex chars. Stable across sessions per device/browser. */
export function shortHash(str) {
  return hash(String(str));
}

function canvasHash() {
  try {
    const c = document.createElement("canvas");
    c.width = 280;
    c.height = 60;
    const x = c.getContext("2d");
    if (!x) return "0";
    x.textBaseline = "top";
    x.font = "14px 'Arial'";
    x.fillStyle = "#f60";
    x.fillRect(125, 1, 62, 20);
    x.fillStyle = "#069";
    x.fillText("👋 fingerprint 漢字 Ω≈ç√", 2, 2);
    x.fillStyle = "rgba(102, 204, 0, 0.7)";
    x.fillText("fingerprint-Ω-漢字", 20, 24);
    return hash(c.toDataURL());
  } catch {
    return "0";
  }
}

const FONT_PROBES = [
  "Arial",
  "Arial Black",
  "Verdana",
  "Courier New",
  "Georgia",
  "Palatino",
  "Garamond",
  "Bookman",
  "Comic Sans MS",
  "Trebuchet MS",
  "Helvetica",
  "Times New Roman",
  "DejaVu Sans",
  "Noto Sans",
  "Segoe UI",
  "Tahoma",
  "Calibri",
  "Cambria",
  "Roboto",
  "San Francisco",
];

function fontHash() {
  try {
    const el = document.createElement("span");
    el.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;font-size:72px;visibility:hidden;white-space:nowrap";
    el.textContent = "mmmmmmlliMWQ@#|";
    document.body.appendChild(el);
    let out = "";
    for (const f of FONT_PROBES) {
      el.style.fontFamily = `"${f}", monospace`;
      out += `${f}:${el.offsetWidth}x${el.offsetHeight}|`;
    }
    el.remove();
    return hash(out);
  } catch {
    return "0";
  }
}

function webglParams() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
    };
  } catch {
    return null;
  }
}

/** Multi-channel fingerprint — combined 16-char id. */
export function collectFingerprint() {
  const screens = [
    screen.width,
    screen.height,
    screen.availWidth,
    screen.availHeight,
    screen.colorDepth,
    window.devicePixelRatio,
  ].join("x");

  const nav = navigator;
  const vals = [
    nav.hardwareConcurrency,
    nav.deviceMemory,
    nav.platform,
    nav.vendor,
    nav.maxTouchPoints,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.language,
  ].join("|");

  const wgl = webglParams();
  const channels = {
    canvas: canvasHash(),
    fonts: fontHash(),
    webgl: wgl ? shortHash(`${wgl.vendor}|${wgl.renderer}`) : "0",
    screen: shortHash(screens),
    nav: shortHash(vals),
  };

  const id = shortHash(Object.values(channels).join(":"));

  return { id, channels, webgl: wgl };
}
