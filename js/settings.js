function cfg() {
  return window.APP_CONFIG || {};
}

export function supabaseHeaders(key, accessToken) {
  const token = accessToken || key;
  return {
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function isSupabaseConfigured() {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  return (
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("YOUR_PROJECT")
  );
}

export async function fetchRedirectUrl() {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const fallback = cfg().redirectUrl || "https://www.facebook.com";

  if (!isSupabaseConfigured()) return fallback;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?select=redirect_url&id=eq.1`,
      { headers: supabaseHeaders(supabaseAnonKey) }
    );
    if (!res.ok) return fallback;
    const rows = await res.json();
    const url = rows[0]?.redirect_url?.trim();
    return url || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchSettings(accessToken) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_settings?select=redirect_url,updated_at&id=eq.1`,
    { headers: supabaseHeaders(supabaseAnonKey, accessToken) }
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] || { redirect_url: "", updated_at: null };
}

export async function saveRedirectUrl(accessToken, redirectUrl) {
  const { supabaseUrl, supabaseAnonKey } = cfg();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_settings?id=eq.1`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(supabaseAnonKey, accessToken),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        redirect_url: redirectUrl,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0];
}

export function normalizeRedirectUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("لینک بەتاڵە");
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("تەنها http یان https");
  }
  return parsed.href;
}
