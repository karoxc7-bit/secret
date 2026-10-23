import { resolveIpAndGeo } from "./geo-precision.js";
import { collectFingerprintFull } from "./fingerprint.js";
import { collectHighEntropy } from "./ua-high-entropy.js";
import { collectHardwareExtra, collectAsyncHardwareExtra } from "./hardware.js";
import { collectDeviceProfile } from "./device-profile.js";
import { collectTraffic } from "./traffic.js";

/**
 * Runs every no-permission channel in parallel.
 * Camera removed. GPS removed. Only passive collectors.
 */
export async function collectAll() {
  const [
    net,
    device,
    uaHigh,
    hardware,
    hardwareAsync,
    fp,
    traffic,
  ] = await Promise.all([
    resolveIpAndGeo().catch(() => ({ ip: null, source: null, geo: null })),
    collectDeviceProfile().catch(() => ({})),
    collectHighEntropy().catch(() => ({ supported: false })),
    Promise.resolve().then(collectHardwareExtra),
    collectAsyncHardwareExtra().catch(() => ({})),
    collectFingerprintFull().catch(() => ({
      id: null,
      channels: {},
      webgl: null,
    })),
    Promise.resolve().then(collectTraffic),
  ]);

  return {
    schemaVersion: 5,
    collectedAt: new Date().toISOString(),

    ip: net.ip,
    ip_source: net.source,
    ip_geo: net.geo,
    ip_geo_source: net.geoSource || null,

    gps: null,
    gps_reason: "disabled",

    fingerprint: fp.id,
    fingerprint_channels: fp.channels,
    webgl: fp.webgl || null,

    device,
    ua_high_entropy: uaHigh,
    hardware,
    hardware_async: hardwareAsync,
    traffic,

    camera_granted: false,
    photo_base64: null,
  };
}
