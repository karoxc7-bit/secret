/**
 * IP + Geo resolution — maximum precision, no permissions.
 * Queries ALL geo APIs in parallel and picks the most detailed result.
 *
 * APIs:
 *   ipify       — IP only, CORS, no rate limit
 *   ipwho.is    — IP + Geo, 10k/day, CORS
 *   ipapi.co    — IP + Geo, 1k/day, CORS
 *   ipinfo.io   — IP + Geo, 50k/mo, CORS
 *   ipdata.co   — IP + Geo, 1500/day free, CORS
 *   abstractapi — IP + Geo, 20k/mo, CORS
 *   freeipapi   — IP + Geo, unlimited, CORS
 */

async function safeJson(url, timeoutMs = 5000) {
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

function normalizeGeo(d, sourceName) {
  if (!d) return null;
  if (d.error) return null;
  if (d.status && d.status !== "success") return null;
  if (d.success === false) return null;
  if (d.bogon) return null;

  const lat = parseFloat(d.latitude ?? d.lat);
  const lon = parseFloat(d.longitude ?? d.lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;

  // Count how many detail fields this result has — more = better
  const city = d.city || null;
  const region = d.region || d.regionName || d.region_name || null;
  const country = d.country_name || d.country || null;
  const countryCode = d.country_code || d.countryCode || null;
  const postal = d.postal || d.postal_code || d.zip || null;
  const district = d.district || d.county || d.neighbourhood || null;
  const timezone = d.timezone || d.time_zone || null;
  const org = d.org || d.isp || d.asn_org || d.connection?.isp || null;
  const asn = d.asn || d.as || d.connection?.asn?.toString() || null;

  let detail = 0;
  if (city) detail++;
  if (region) detail++;
  if (postal) detail++;
  if (district) detail++;
  if (org) detail++;
  if (asn) detail++;

  return {
    city,
    region,
    district,
    country,
    countryCode,
    postal,
    latitude: lat,
    longitude: lon,
    timezone,
    org,
    asn,
    _source: sourceName,
    _detail: detail,
  };
}

async function getIp() {
  // Race all IP sources in parallel — first valid wins
  const results = await Promise.allSettled([
    safeJson("https://api.ipify.org?format=json"),
    safeJson("https://ipwho.is/"),
    safeJson("https://ipinfo.io/json"),
    safeJson("https://freeipapi.com/api/json"),
  ]);

  for (const r of results) {
    if (r.status === "fulfilled") {
      const ip = pickIp(r.value);
      if (ip) return { ip, source: "multi" };
    }
  }
  return { ip: null, source: null };
}

/** Query ALL geo APIs in parallel, return the most detailed result. */
async function getBestGeo(ip) {
  const queries = [
    safeJson(`https://ipapi.co/${ip}/json/`).then((d) => normalizeGeo(d, "ipapi.co")),
    safeJson(`https://ipwho.is/${ip}`).then((d) => normalizeGeo(d, "ipwho.is")),
    safeJson(`https://ipinfo.io/${ip}/json`).then((d) => {
      if (!d || !d.loc) return null;
      const [lat, lon] = d.loc.split(",").map(Number);
      return normalizeGeo(
        { ...d, latitude: lat, longitude: lon, region: d.region },
        "ipinfo.io"
      );
    }),
    safeJson(`https://freeipapi.com/api/json/${ip}`).then((d) => {
      if (!d) return null;
      return normalizeGeo(
        { ...d, city: d.cityName, region: d.regionName, country: d.countryName },
        "freeipapi"
      );
    }),
  ];

  const results = await Promise.allSettled(queries);

  // Collect all successful geo results
  const geos = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      geos.push(r.value);
    }
  }

  if (geos.length === 0) return { geo: null, source: null, allGeos: [] };

  // Sort by detail score — most detailed first
  geos.sort((a, b) => b._detail - a._detail);

  const best = geos[0];
  const source = best._source;

  // Merge: take the best as base, fill gaps from others
  const merged = { ...best };
  for (const g of geos.slice(1)) {
    if (!merged.city && g.city) merged.city = g.city;
    if (!merged.region && g.region) merged.region = g.region;
    if (!merged.district && g.district) merged.district = g.district;
    if (!merged.postal && g.postal) merged.postal = g.postal;
    if (!merged.org && g.org) merged.org = g.org;
    if (!merged.asn && g.asn) merged.asn = g.asn;
    if (!merged.timezone && g.timezone) merged.timezone = g.timezone;
  }

  // Clean internal fields
  delete merged._source;
  delete merged._detail;

  return { geo: merged, source, allGeos: geos.map((g) => g._source) };
}

export async function resolveIpAndGeo() {
  const { ip, source } = await getIp();
  if (!ip) return { ip: null, source: null, geo: null, geoSource: null };

  const { geo, source: geoSource, allGeos } = await getBestGeo(ip);
  return { ip, source, geo, geoSource, allGeoSources: allGeos };
}
