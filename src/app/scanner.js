// The camera and the code reader. `openCamera(video)` starts the back camera in a <video>; `readFrame` looks for a QR code in
// what the camera sees. The browser's own BarcodeDetector is used where it exists, and the jsqr package (loaded only then)
// where it does not. The camera only works on https or localhost; `cameraPossible()` says whether it can be tried at all.

const FRAME_MAX = 480; // jsqr reads a picture this wide at most, to stay quick on a phone

export const cameraPossible = () => window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";

// A plain sentence for each way the camera can fail.
export function cameraProblem(e) {
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") return "The camera is blocked for this page. Allow it in the browser's settings, or type the code.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "This phone has no camera this page can use. Type the code instead.";
  if (e?.name === "NotReadableError" || e?.name === "AbortError") return "The camera is busy in another app. Close that app, or type the code.";
  return `The camera did not start (${e?.message || e?.name || "unknown reason"}). Type the code instead.`;
}

// Starts the back camera and shows it in `video`. Returns a function that stops it.
export async function openCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute("playsinline", "");
  await video.play();
  return () => { for (const t of stream.getTracks()) t.stop(); video.srcObject = null; };
}

// Builds a reader: `read(video)` resolves with the text of a QR code in the current frame, or "" when there is none.
export async function makeReader() {
  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? "";
    } catch { /* a browser that has the class but not the format: use jsqr */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!video.videoWidth) return "";
    const k = Math.min(1, FRAME_MAX / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * k);
    canvas.height = Math.round(video.videoHeight * k);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ?? "";
  };
}
