// The projector and the camera can stand across from the players, facing them: on a train the gear sits on the far side
// of the aisle. Then the picture is turned half way round so it reads from the players' side, and what the camera sees
// on its left is on the players' right. One saved switch says so, and every part that cares asks here.
// Nicolo, Sat 21 Nov 2026, after the first test on the real floor: "our projection needs to be flipped 180 degrees
// because it's being held up on the other end of the person, not from their back. It's aiming at them from the front."
const KEY = "pp:facing";

export const isFacing = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }; // no storage (a test): off
export const setFacing = (on) => localStorage.setItem(KEY, on ? "1" : "0");

// The keystone's four corners (top left, top right, bottom right, bottom left) with the picture turned half way round:
// the picture's top left lands where its bottom right was.
export const turned = (corners, facing = isFacing()) => (facing ? [corners[2], corners[3], corners[0], corners[1]] : corners);
