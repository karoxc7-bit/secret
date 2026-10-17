/**
 * File helpers for the admin dashboard.
 *   - Download a visit payload as JSON (full record, without base64 photo).
 *   - Download the selfie as a .jpg.
 *   - Export all visible visits as a single .json archive.
 */

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(obj, filename) {
  const text = JSON.stringify(obj, null, 2);
  downloadBlob(new Blob([text], { type: "application/json;charset=utf-8" }), filename);
}

export function downloadVisitJson(visit) {
  const copy = { ...visit };
  delete copy.photo_base64;
  downloadJson(copy, `visit-${visit.id}-${ts()}.json`);
}

export function downloadSelfie(visit) {
  if (!visit.photo_base64) return false;
  const dataUrl = visit.photo_base64;
  const [meta, b64] = dataUrl.split(",");
  if (!b64) return false;
  const mime = /image\/(\w+)/.exec(meta)?.[1] || "jpeg";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  downloadBlob(
    new Blob([bytes], { type: `image/${mime}` }),
    `selfie-${visit.id}-${ts()}.${mime === "jpeg" ? "jpg" : mime}`
  );
  return true;
}

export function exportArchive(visits) {
  const cleaned = visits.map((v) => {
    const c = { ...v };
    if (c.photo_base64) c.photo_base64_stripped = true;
    delete c.photo_base64;
    return c;
  });
  downloadJson(
    { exportedAt: new Date().toISOString(), count: cleaned.length, visits: cleaned },
    `visits-${ts()}.json`
  );
}
