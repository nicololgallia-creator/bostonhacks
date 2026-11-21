// A stand-in for the camera: the mouse is one foot. Used to build and test the game with no hardware.
// Every feet source has the same shape: start() then read() -> [{u, v}] in field coordinates,
// where u runs 0 (left) to 1 (right) across the lanes and v runs 0 (far edge) to 1 (players' edge).
export function mouseFeet(element) {
  let foot = null;
  const move = (e) => {
    const r = element.getBoundingClientRect();
    foot = { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  };
  return {
    start: async () => { element.addEventListener("pointermove", move); element.addEventListener("pointerleave", () => { foot = null; }); },
    read: () => (foot && foot.u >= 0 && foot.u <= 1 && foot.v >= 0 && foot.v <= 1 ? [foot] : []),
  };
}
