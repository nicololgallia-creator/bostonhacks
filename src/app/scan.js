// What a scanned or typed code may do. The app never opens a scanned link. A code is read for a few values only, and the
// app then moves to its OWN address with those values. Anything else in the code is thrown away.
import { ALPHABET, isRoom } from "../link-relay.js";

const MAX_LENGTH = 2048;             // a longer text is not one of our codes
const WORD = /^[A-Za-z0-9-]{1,40}$/; // a line id ("Green-B") or a stop id ("place-bucen")

// The values a code gives, or null when it is not ours. Taken: `room` (8 characters of the room alphabet, either case),
// `line`, `dir` (0 or 1), `at`, `car` (1 to 12). A part that is wrong is left out; a bad or missing room is no code at all.
// A bare 8-character code is a room with no train.
export function parseCode(text) {
  if (typeof text !== "string" || text.length > MAX_LENGTH) return null;
  const raw = text.trim();
  if (isRoom(raw.toUpperCase())) return { room: raw.toUpperCase() };
  let url;
  try { url = new URL(raw); } catch { return null; } // plain text, or a link with no address
  if (url.protocol !== "https:" && url.protocol !== "http:") return null; // javascript:, data:, intent: and the rest
  const q = url.searchParams;
  const room = (q.get("room") ?? "").toUpperCase();
  if (!isRoom(room)) return null;
  const out = { room };
  if (WORD.test(q.get("line") ?? "")) out.line = q.get("line");
  if (q.get("dir") === "0" || q.get("dir") === "1") out.dir = q.get("dir");
  if (WORD.test(q.get("at") ?? "")) out.at = q.get("at");
  const car = Number(q.get("car"));
  if (/^\d{1,2}$/.test(q.get("car") ?? "") && car >= 1 && car <= 12) out.car = String(car);
  return out;
}

// The app's own address for a parsed code: this page's origin and path, and only the parsed values.
export function ownAddress(parts, loc = location) {
  const q = new URLSearchParams();
  for (const key of ["room", "line", "dir", "at", "car"]) if (parts[key] !== undefined) q.set(key, parts[key]);
  return `${loc.origin}${loc.pathname}?${q}`;
}

// Why a typed code is not one, in plain words, or "" when it is. Spaces and dashes people add are ignored.
export function codeProblem(typed) {
  const code = typed.replace(/[\s-]/g, "").toUpperCase();
  if (!code) return "Type the 8 letters and numbers shown on the floor.";
  if (/[^A-Z0-9]/.test(code)) return "A room code has only letters and numbers.";
  if ([...code].some((c) => !ALPHABET.includes(c))) return "A room code never has 0, 1, I, or O. Check the code.";
  if (code.length !== 8) return `A room code has 8 characters. You typed ${code.length}.`;
  return "";
}
