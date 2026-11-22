import test from "node:test";
import assert from "node:assert/strict";
import { installOn, defaultFacing, chooseCamera, pickInstallCamera, cameraOf, cleanLabel, isLaptopCamera, stripFor, NAME_MS } from "./install.js";
import { setFacing, isFacing } from "../facing.js";

const memory = (start = {}) => {
  const data = { ...start };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
};
const cam = (id, label) => ({ id, label });
const LAPTOP = cam("a", "Integrated Camera (0408:5365)");
const IR = cam("b", "Integrated IR Camera (0408:5366)");
const OSMO = cam("c", "DJI Osmo Action 4 (2ca3:0023)");

test("install mode: the address turns it on, remembered; ?install=0 turns it off", () => {
  const s = memory();
  assert.equal(installOn("", s), false);
  assert.equal(installOn("?install=1", s), true);
  assert.equal(installOn("", s), true, "remembered with no address");
  assert.equal(installOn("?feet=mouse", s), true);
  assert.equal(installOn("?install=0", s), false);
  assert.equal(installOn("", s), false, "stays off");
  assert.equal(installOn("?install=1", null), true, "no storage: the address alone");
  assert.equal(installOn("", null), false);
});

test("install mode turns the picture for a projector facing the players, unless someone chose", () => {
  const fresh = memory();
  defaultFacing(fresh);
  assert.equal(fresh.getItem("pp:facing"), "1");
  const off = memory({ "pp:facing": "0" });
  defaultFacing(off);
  assert.equal(off.getItem("pp:facing"), "0", "set to off by a person: kept");
  // the key must be the one facing.js reads
  globalThis.localStorage = memory();
  try {
    defaultFacing(globalThis.localStorage);
    assert.equal(isFacing(), true);
    setFacing(false);
    defaultFacing(globalThis.localStorage);
    assert.equal(isFacing(), false);
  } finally { delete globalThis.localStorage; }
});

test("camera: the Osmo wins over the laptop, whatever the order, in any case", () => {
  const r = chooseCamera([LAPTOP, cam("x", "USB Camera"), OSMO]);
  assert.deepEqual([r.id, r.reason, r.label, r.laptop, r.remember], ["c", "osmo", "DJI Osmo Action 4", false, true]);
  assert.equal(chooseCamera([LAPTOP, cam("d", "dji pocket")]).id, "d");
  assert.equal(chooseCamera([LAPTOP, cam("e", "GoPro ACTION cam")]).id, "e");
});

test("camera: only the laptop's own is used, with the reason, and not remembered", () => {
  const r = chooseCamera([IR, LAPTOP]);
  assert.deepEqual([r.id, r.reason, r.laptop, r.remember], ["a", "laptop", true, false], "the infrared camera is not picked");
  assert.equal(chooseCamera([cam("f", "FaceTime HD Camera")]).reason, "laptop");
  assert.equal(chooseCamera([IR]).id, "b", "nothing else: use it");
});

test("camera: an outside camera with an unknown name beats the laptop's", () => {
  const r = chooseCamera([LAPTOP, cam("g", "USB Video Device")]);
  assert.deepEqual([r.id, r.reason, r.laptop, r.remember], ["g", "outside", false, true]);
  assert.equal(chooseCamera([cam("g", "USB Video Device"), cam("h", "Logitech C920")]).id, "g", "the first one");
});

test("camera: a saved camera still there is kept, even the laptop's; one that vanished is chosen again by the rule", () => {
  assert.equal(chooseCamera([LAPTOP, OSMO], "a").reason, "saved");
  assert.equal(chooseCamera([LAPTOP, OSMO], "a").id, "a");
  const gone = chooseCamera([LAPTOP, OSMO], "was-unplugged");
  assert.deepEqual([gone.id, gone.reason], ["c", "osmo"]);
  assert.equal(chooseCamera([LAPTOP], "was-unplugged").reason, "laptop");
});

test("camera: no cameras", () => {
  assert.deepEqual(chooseCamera([]), { id: null, label: "", reason: "none", laptop: false, remember: false });
  assert.equal(chooseCamera([], "saved").reason, "none");
});

test("names: the usb ids go, and the laptop's words are found in any case", () => {
  assert.equal(cleanLabel("DJI Osmo Action 4 (2ca3:0023)"), "DJI Osmo Action 4");
  assert.equal(cleanLabel("Camera (Pro)"), "Camera (Pro)");
  assert.equal(isLaptopCamera("INTEGRATED WEBCAM"), true);
  assert.equal(isLaptopCamera("HD Webcam"), true);
  assert.equal(isLaptopCamera("Built-in iSight"), true);
  assert.equal(isLaptopCamera("DJI Osmo Action 4"), false);
  assert.equal(isLaptopCamera(undefined), false);
});

test("pickInstallCamera: no names yet means one camera is opened and let go, then the names are read", async () => {
  let opened = 0, stopped = 0, named = false;
  const media = {
    enumerateDevices: async () => [{ kind: "audioinput", deviceId: "m", label: "" }, { kind: "videoinput", deviceId: "a", label: named ? "Integrated Camera" : "" }, { kind: "videoinput", deviceId: "c", label: named ? "DJI Osmo Action 4" : "" }],
    getUserMedia: async () => { opened++; named = true; return { getTracks: () => [{ stop: () => { stopped++; } }] }; },
  };
  const r = await pickInstallCamera(null, media);
  assert.deepEqual([r.id, r.reason, opened, stopped], ["c", "osmo", 1, 1]);
  const again = await pickInstallCamera(null, media); // names known now: nothing is opened
  assert.deepEqual([again.id, opened], ["c", 1]);
});

test("pickInstallCamera: a blocked camera passes the browser's error on, and no camera is 'none'", async () => {
  const blocked = { enumerateDevices: async () => [{ kind: "videoinput", deviceId: "a", label: "" }], getUserMedia: async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); } };
  await assert.rejects(pickInstallCamera(null, blocked), { name: "NotAllowedError" });
  assert.equal((await pickInstallCamera(null, { enumerateDevices: async () => [] })).reason, "none");
});

test("cameraOf reads the name from the video's own stream", () => {
  const feet = (label) => ({ video: { srcObject: { getVideoTracks: () => [{ label }] } } });
  assert.deepEqual(cameraOf(feet("DJI Osmo Action 4 (2ca3:0023)")), { label: "DJI Osmo Action 4", laptop: false });
  assert.deepEqual(cameraOf(feet("Integrated Camera")), { label: "Integrated Camera", laptop: true });
  assert.equal(cameraOf({}), null);
  assert.equal(cameraOf({ video: { srcObject: null } }), null);
});

test("the strip: a problem shows in the lobby, the camera is named for a while, the laptop's own stays up", () => {
  const osmo = { label: "DJI Osmo Action 4", laptop: false }, own = { label: "Integrated Camera", laptop: true };
  assert.deepEqual(stripFor({ lobby: true, camera: osmo, seated: true, sinceMs: 0 }), { text: "Camera: DJI Osmo Action 4", alert: false });
  assert.equal(stripFor({ lobby: true, camera: osmo, seated: true, sinceMs: NAME_MS }), null, "gone after about 6 seconds");
  assert.deepEqual(stripFor({ lobby: true, camera: own, seated: true, sinceMs: 60000 }), { text: "Camera: the laptop's own. Press C to change.", alert: true });
  assert.equal(stripFor({ lobby: true, camera: own, seated: false, sinceMs: 60000 }), null, "only seated play needs the tripod's camera");
  assert.deepEqual(stripFor({ lobby: true, camera: own, seated: false, sinceMs: 0 }), { text: "Camera: Integrated Camera", alert: false });
  assert.deepEqual(stripFor({ lobby: true, problem: "No camera found.", camera: osmo, seated: true, sinceMs: 0 }), { text: "No camera found.", alert: true });
  assert.equal(stripFor({ lobby: false, problem: "No camera found.", camera: own, seated: true, sinceMs: 0 }), null, "never over a song");
  assert.equal(stripFor({ lobby: true, camera: null, seated: true, sinceMs: 0 }), null, "the mouse has no camera to name");
});
