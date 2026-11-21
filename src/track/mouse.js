// A stand-in for the camera: the mouse is one foot, and it is on the floor only while the button is held.
// A click is a tap. Press and hold is a hold. Resting the mouse on a lane does nothing.
// Every feet source has the same shape: start() then read() -> [{u, v}] in field coordinates,
// where u runs 0 (left) to 1 (right) across the lanes and v runs 0 (far edge) to 1 (players' edge).
export function mouseFeet(element) {
  let foot = null;
  let down = false;
  let unread = false; // a click shorter than one frame is still shown for one read
  const move = (e) => {
    const r = element.getBoundingClientRect();
    foot = { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  };
  const up = () => { down = false; };
  return {
    start: async () => {
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerdown", (e) => { move(e); element.setPointerCapture(e.pointerId); down = true; unread = true; });
      element.addEventListener("pointerup", up);
      element.addEventListener("pointercancel", up);
    },
    read: () => {
      const pressed = down || unread;
      unread = false;
      return pressed && foot && foot.u >= 0 && foot.u <= 1 && foot.v >= 0 && foot.v <= 1 ? [foot] : [];
    },
  };
}
