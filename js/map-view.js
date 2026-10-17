/**
 * Location map component for the admin dashboard.
 * Draws a Leaflet map with markers for every visit that carries any coordinate
 * source (GPS or IP geo), plus a per-visit static thumbnail.
 */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoader = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("leaflet load failed"));
    document.head.appendChild(script);
  });
  return leafletLoader;
}

function getCoord(visit) {
  if (visit.location?.latitude != null && visit.location?.longitude != null) {
    return {
      lat: visit.location.latitude,
      lon: visit.location.longitude,
      acc: visit.location.accuracy ?? null,
      kind: "gps",
    };
  }
  const g = visit.ip_geo || visit.device_info?.network?.ipGeo;
  if (g?.latitude != null && g?.longitude != null) {
    return {
      lat: g.latitude,
      lon: g.longitude,
      acc: null,
      kind: "ip",
      city: g.city,
      country: g.country,
    };
  }
  return null;
}

function markerColor(kind) {
  return kind === "gps" ? "#22c55e" : "#3b82f6";
}

function escapeHtml(t) {
  return String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function mountVisitMap(container, visits) {
  if (!container) return;
  const L = await loadLeaflet();

  if (!container._leafletMap) {
    container.innerHTML = "";
    container.style.height = container.style.height || "380px";
    container._leafletMap = L.map(container, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(container._leafletMap);
    container._leafletMap.attributionControl.setPrefix("");
  }

  const map = container._leafletMap;
  if (container._markerLayer) {
    container._markerLayer.remove();
  }
  container._markerLayer = L.layerGroup().addTo(map);

  let gpsCount = 0;
  let ipCount = 0;
  const bounds = [];

  for (const v of visits) {
    const c = getCoord(v);
    if (!c) continue;

    if (c.kind === "gps") gpsCount++;
    else ipCount++;
    bounds.push([c.lat, c.lon]);

    const when = v.created_at ? new Date(v.created_at).toLocaleString("ku") : "—";
    const accuracy =
      c.acc != null ? ` · ±${Math.round(c.acc)}m` : "";
    const cityInfo = c.kind === "ip" ? `<div>${escapeHtml(c.city || "")}${c.city && c.country ? ", " : ""}${escapeHtml(c.country || "")}</div>` : "";

    const dot = L.circleMarker([c.lat, c.lon], {
      radius: c.kind === "gps" ? 8 : 6,
      color: markerColor(c.kind),
      weight: 2,
      fillColor: markerColor(c.kind),
      fillOpacity: c.kind === "gps" ? 0.85 : 0.55,
    });

    if (c.kind === "gps" && c.acc != null && c.acc < 5000) {
      L.circle([c.lat, c.lon], {
        radius: c.acc,
        color: markerColor(c.kind),
        weight: 1,
        opacity: 0.4,
        fillColor: markerColor(c.kind),
        fillOpacity: 0.12,
      }).addTo(container._markerLayer);
    }

    dot.bindPopup(
      `<div style="font-family:system-ui,sans-serif;font-size:12px;direction:ltr">
        <strong>${c.kind === "gps" ? "GPS" : "IP"}</strong>${accuracy}
        ${cityInfo}
        <div>${escapeHtml(when)}</div>
        <div>${escapeHtml(v.ip || "")}</div>
      </div>`
    );
    dot.addTo(container._markerLayer);
  }

  const stats = container.parentElement?.querySelector("[data-map-stats]");
  if (stats) {
    stats.textContent = `${gpsCount} GPS · ${ipCount} IP · ${bounds.length} خاڵ`;
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 12);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }
}

export function getVisitCoords(visit) {
  return getCoord(visit);
}
