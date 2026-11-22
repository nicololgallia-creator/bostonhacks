// The camera and the code reader. `openCamera(video)` starts the back camera in a <video>; `makeReader()` builds a reader that
// looks for a QR code in what the camera sees. The phone's own BarcodeDetector goes first where it exists. When it finds
// nothing, our own reader (zxing, from the barcode-detector package, its .wasm file served from this site) looks too, so
// the phone's reader is never trusted alone. Our looks alternate between the whole picture and the part the yellow frame
// covers, so each look stays quick. The camera only works on https or localhost; `cameraPossible()` says whether it can be tried.

export const FRAME_INSET = 0.14; // the yellow frame sits this far in from every edge of the viewfinder (scan.css, .frame)
const CROP_INSET = 0.07;         // our looks at the frame take a little more than the frame, so a code at its edge is whole
const CROP_SCALE = 1.5;          // the framed part is enlarged this much, up to CROP_MAX pixels on its long side
const CROP_MAX = 1000;

export const cameraPossible = () => window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";

// A plain sentence for each way the camera or the reader can fail.
export function cameraProblem(e) {
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") return "The camera is blocked for this page. Allow it in the browser's settings, or type the code.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "This phone has no camera this page can use. Type the code instead.";
  if (e?.name === "NotReadableError" || e?.name === "AbortError") return "The camera is busy in another app. Close that app, or type the code.";
  if (e?.name === "ReaderError") return `The code reader did not load (${e.message}). Type the code instead.`;
  return `The camera did not start (${e?.message || e?.name || "unknown reason"}). Type the code instead.`;
}

// Starts the back camera and shows it in `video`. Asks for a real picture (up to 1920x1080) and falls back to the plain
// request when the phone refuses that. Returns a function that stops it.
export async function openCamera(video) {
  const media = navigator.mediaDevices;
  let stream;
  try {
    stream = await media.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) {
    if (e?.name !== "OverconstrainedError") throw e;
    stream = await media.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  }
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute("playsinline", "");
  await video.play();
  return () => { for (const t of stream.getTracks()) t.stop(); video.srcObject = null; };
}

// The part of a picture `vw` x `vh` that lies inside the yellow frame (or `inset` from the edge of what the box shows), when
// the picture is shown in a box `boxW` x `boxH` with object-fit: cover (the box shows the middle of the picture). In the
// picture's own pixels.
export function frameCrop(vw, vh, boxW, boxH, inset = FRAME_INSET) {
  const boxAspect = boxW / boxH;
  const wider = vw / vh > boxAspect;
  const shownW = wider ? vh * boxAspect : vw;
  const shownH = wider ? vh : vw / boxAspect;
  return {
    x: Math.round((vw - shownW) / 2 + shownW * inset), y: Math.round((vh - shownH) / 2 + shownH * inset),
    w: Math.round(shownW * (1 - 2 * inset)), h: Math.round(shownH * (1 - 2 * inset)),
  };
}

// What look number `n` reads: the whole picture on even looks (null), the framed part on odd ones. A part is the area
// `sx, sy, sw, sh` of the picture, drawn `dw` x `dh` pixels big.
export function lookPlan(n, vw, vh, boxW, boxH) {
  if (n % 2 === 0) return null;
  const r = frameCrop(vw, vh, boxW, boxH, CROP_INSET);
  const k = Math.min(CROP_SCALE, CROP_MAX / Math.max(r.w, r.h));
  return { sx: r.x, sy: r.y, sw: r.w, sh: r.h, dw: Math.max(1, Math.round(r.w * k)), dh: Math.max(1, Math.round(r.h * k)) };
}

// What the screen says under the viewfinder while the camera is live and nothing has been read, by how long that has gone on.
// After the second step it also shows a small line a person can photograph, so a failure can be understood from the picture.
export const HINT_AFTER_MS = 6000;
export const DEBUG_AFTER_MS = 12000;
export function waitingHelp(ms) {
  if (ms >= DEBUG_AFTER_MS) return { say: "Move closer until the code fills the frame.", debug: true };
  if (ms >= HINT_AFTER_MS) return { say: "Move closer until the code fills the frame.", debug: false };
  return { say: "Point the camera at the code.", debug: false };
}
// For example "1280x720, our reader, 61 looks".
export const debugLine = (vw, vh, kind, looks) => `${vw}x${vh}, ${kind}, ${looks} ${looks === 1 ? "look" : "looks"}`;

// Loads our reader. Its .wasm file comes from this site's own build, never from a CDN.
export async function loadReader() {
  try {
    const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([import("barcode-detector/ponyfill"), import("zxing-wasm/reader/zxing_reader.wasm?url")]);
    setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) });
    return new BarcodeDetector({ formats: ["qr_code"] });
  } catch (e) {
    throw Object.assign(new Error(e?.message || "unknown reason"), { name: "ReaderError" });
  }
}

let part = null;
// One look of our reader at `source` (a video or a canvas). Returns the text of a code, or "".
export async function readLook(reader, source, vw, vh, boxW, boxH, n) {
  const plan = lookPlan(n, vw, vh, boxW, boxH);
  let target = source;
  if (plan) {
    part ??= document.createElement("canvas");
    part.width = plan.dw;
    part.height = plan.dh;
    part.getContext("2d", { willReadFrequently: true }).drawImage(source, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.dw, plan.dh);
    target = part;
  }
  return (await reader.detect(target))[0]?.rawValue ?? "";
}

// Builds a reader: `read(video, box)` resolves with the text of a QR code in the current frame, or "" when there is none.
// `box` is the viewfinder's size on screen, `{ w, h }`. `kind` says which readers are in use, for the screen to show.
export async function makeReader() {
  let phone = null;
  if ("BarcodeDetector" in window) {
    try { phone = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch { /* a browser with the class but not the format: ours alone */ }
  }
  // Ours failing to load (an old phone, a blocked .wasm) must not take the phone's own reader down with it.
  const ours = await loadReader().catch((e) => { if (!phone) throw e; return null; });
  let n = 0;
  return {
    kind: !ours ? "the phone's reader" : phone ? "the phone's reader and ours" : "our reader",
    async read(video, box) {
      if (!video.videoWidth) return "";
      if (phone) {
        const found = await phone.detect(video).then((codes) => codes[0]?.rawValue, () => ""); // a look it cannot make is a look that found nothing
        if (found || !ours) return found || "";
      }
      return readLook(ours, video, video.videoWidth, video.videoHeight, box.w, box.h, n++);
    },
  };
}


