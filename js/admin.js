function cfg() {
  return window.APP_CONFIG || {};
}

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function fetchVisits(accessToken) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/visits?select=*&order=created_at.desc&limit=100`,
    {
      headers: {
        ...supabaseHeaders(supabaseAnonKey),
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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

function renderVisit(v) {
  const di = v.device_info || {};
  const loc = v.location;
  const mapLink =
    loc && loc.latitude != null
      ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
      : null;

  const photo =
    v.photo_base64 && v.camera_granted
      ? `<img class="thumb" src="${v.photo_base64}" alt="selfie" />`
      : "<span class=\"meta\">وێنە: ڕەزامەندی نەدراوە</span>";

  return `
    <article class="visit-item">
      <time>${new Date(v.created_at).toLocaleString("ku")}</time>
      <div class="meta"><strong>IP:</strong> ${v.ip || "—"}</div>
      <div class="meta"><strong>کامێرا:</strong> ${v.camera_granted ? "بەڵێ" : "نەخێر"} ·
        <strong>لۆکەیشن:</strong> ${v.location_granted ? "بەڵێ" : "نەخێر"}
        ${mapLink ? ` · <a href="${mapLink}" target="_blank" rel="noopener">سەر نەخشە</a>` : ""}
      </div>
      <div class="meta"><strong>Platform:</strong> ${di.platform || "—"}</div>
      <div class="meta"><strong>UA:</strong> ${di.userAgent || "—"}</div>
      ${photo}
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

  const TOKEN_KEY = "admin_access_token";

  async function loadDashboard() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    loginView.classList.add("hidden");
    dashView.classList.remove("hidden");
    try {
      const visits = await fetchVisits(token);
      listEl.innerHTML = visits.length
        ? visits.map(renderVisit).join("")
        : "<p class=\"status\">هێشتا سەردانێک نییە.</p>";
    } catch (e) {
      listEl.innerHTML = `<p class="status error">${e.message}</p>`;
    }
  }

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
  });

  loadDashboard();
}
