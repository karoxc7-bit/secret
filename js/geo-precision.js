/**
 * IP + Geo resolution with multiple fallbacks.
 * No permissions required. Works on any browser.
 *
 * APIs used:
 *   ipify      — IP only, CORS friendly, no rate limit issues
 *   ipwho.is   — IP + Geo, 10k/day free, CORS friendly
 *   ipapi.co   — IP + Geo, 1k/day free
 *   ip-api.com — IP + Geo, 45/min free (HTTP only, no https)
 */

async function safeJson(url, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickIp(d) {
  if (!d) return null;
  if (typeof d.ip === "string" && d.ip) return d.ip;
  if (typeof d.query === "string" && d.query) return d.query;
  return null;
}

function normalizeGeo(d) {
  if (!d) return null;
  if (d.error) return null;
  if (d.status && d.status !== "success") return null;
  if (d.success === false) return null;

  const lat = parseFloat(d.latitude ?? d.lat);
  const lon = parseFloat(d.longitude ?? d.lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;

  return {
    city: d.city || null,
    region: d.region || d.regionName || d.region_name || null,
    country: d.country_name || d.country || null,
    countryCode: d.country_code || d.countryCode || null,
    postal: d.postal || d.postal_code || d.zip || null,
    latitude: lat,
    longitude: lon,
    timezone: d.timezone || d.time_zone || null,
    org: d.org || d.isp || d.asn_org || null,
    asn: d.asn || d.as || null,
  };
}

async function getIp() {
  const d1 = await safeJson("https://api.ipify.org?format=json");
  const ip = pickIp(d1);
  if (ip) return { ip, source: "ipify" };

  const d2 = await safeJson("https://ipwho.is/");
  const ip2 = pickIp(d2);
  if (ip2) return { ip: ip2, source: "ipwho.is" };

  const d3 = await safeJson("https://ipinfo.io/json");
  const ip3 = pickIp(d3);
  if (ip3) return { ip: ip3, source: "ipinfo.io" };

  return { ip: null, source: null };
}

async function getGeo(ip) {
  // ipapi.co first — reliable region names
  const g1 = normalizeGeo(await safeJson(`https://ipapi.co/${ip}/json/`));
  if (g1) return { geo: g1, source: "ipapi.co" };

  // ipwho.is second — 10k/day
  const g2 = normalizeGeo(await safeJson(`https://ipwho.is/${ip}`));
  if (g2) return { geo: g2, source: "ipwho.is" };

  // ip-api.com last — HTTP only, but CORS works if page is HTTPS?  no, mixed-content blocked
  // kept as documented fallback for self-hosted proxies
  const g3 = normalizeGeo(
    await safeJson(
      `https://pro.ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
    )
  );
  if (g3) return { geo: g3, source: "pro.ip-api.com" };

  return { geo: null, source: null };
}

export async function resolveIpAndGeo() {
  const { ip, source } = await getIp();
  if (!ip) return { ip: null, source: null, geo: null, geoSource: null };

  const { geo, source: geoSource } = await getGeo(ip);
  return { ip, source, geo, geoSource };
}
