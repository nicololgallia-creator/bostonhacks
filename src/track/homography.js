// The map from camera picture to field. A homography is a 3x3 matrix, kept as a flat array of 9
// numbers in row order, so it can go straight into localStorage as JSON.
// Pure maths, no browser calls.

const NOT_FOUR = "Four points and four matches are needed to line the camera up with the field.";
const IN_A_LINE = (name) => `Three of the ${name} points are in a line. Click four different corners of the field, spread out like a rectangle.`;

// True when a, b and c sit on one line (or two of them are the same point).
function straight(a, b, c) {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const size = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
  return Math.abs(cross) <= 1e-3 * size;
}

function checkFour(points, name) {
  if (!Array.isArray(points) || points.length !== 4 || points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error(NOT_FOUR);
  }
  for (let skip = 0; skip < 4; skip++) {
    const [a, b, c] = points.filter((_, i) => i !== skip);
    if (straight(a, b, c)) throw new Error(IN_A_LINE(name));
  }
}

// Matrix that sends each point in `from` to the point in `to` with the same index.
export function solve(from, to) {
  checkFour(from, "camera");
  checkFour(to, "field");
  // Eight unknowns h0..h7 (h8 is 1). Each pair of points gives two equations.
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with the largest pivot in each column.
  for (let col = 0; col < 8; col++) {
    let best = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[best][col])) best = r;
    if (Math.abs(rows[best][col]) < 1e-12) throw new Error(IN_A_LINE("camera"));
    [rows[col], rows[best]] = [rows[best], rows[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = rows[r][col] / rows[col][col];
      for (let c = col; c < 9; c++) rows[r][c] -= f * rows[col][c];
    }
  }
  return [...rows.map((row, i) => row[8] / row[i]), 1];
}

// Where the matrix sends a point. Returns null when the point has no place on the field
// (it lies on the horizon of the camera's view).
export function apply(m, { x, y }) {
  const w = m[6] * x + m[7] * y + m[8];
  if (Math.abs(w) < 1e-12) return null;
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

// The matrix that undoes `m`: field back to camera picture.
export function invert(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("That map cannot be reversed. Redo the four clicks.");
  return [A, c * h - b * i, b * f - c * e, B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d].map((n) => n / det);
}
