// Splits one song across 1 to 4 seats. Pure logic, no browser calls.
// Every seat plays the whole song at the same time. The seats share one keyboard: with n seats there are
// 2n lanes, two for each seat (one for each foot). The keyboard is balanced: each pitch takes a width equal
// to its share of the notes, laid out low to high from the left, so every lane gets about the same number of
// notes. A pitch that sits inside one lane sends all its notes there. A pitch that crosses lanes shares its
// notes between them in proportion to its width in each, in time order, so the notes alternate between
// neighbouring feet instead of hammering one.
export const LANES_PER_SEAT = 2;
const EPS = 1e-9; // widths are floats, so a pitch that ends exactly on a lane edge must not leak into the next lane

// Returns `seats` songs, each the same song with only the notes of that seat's two lanes. Each note carries
// its own `lane` (0 or 1) on that seat's pad. The song's backing is kept on every part.
export function splitParts(song, seats) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    throw new Error(`A song can be split for 1 to 4 players, not ${seats}.`);
  }
  const lanes = seats * LANES_PER_SEAT;
  const total = song.notes.length;
  const counts = new Map();
  for (const { midi } of song.notes) counts.set(midi, (counts.get(midi) ?? 0) + 1);

  // For each pitch, low to high: the lanes its width covers and how much of it lies in each.
  const share = new Map();
  let before = 0;
  for (const midi of [...counts.keys()].sort((a, b) => a - b)) {
    const from = (before / total) * lanes;
    const to = ((before + counts.get(midi)) / total) * lanes;
    before += counts.get(midi);
    const first = Math.floor(from + EPS);
    const last = Math.max(first, Math.ceil(to - EPS) - 1);
    share.set(midi, Array.from({ length: last - first + 1 }, (_, i) => {
      const lane = first + i;
      return { lane, weight: Math.min(to, lane + 1) - Math.max(from, lane), credit: 0 };
    }));
  }

  const parts = Array.from({ length: seats }, () => []);
  for (const note of song.notes) {
    const options = share.get(note.midi);
    // Smooth weighted round robin: each note, every lane earns its weight, the richest lane takes the
    // note and pays the total, so a lane with twice the weight gets twice the notes, evenly spaced.
    const sum = options.reduce((s, o) => s + o.weight, 0);
    let pick = options[0];
    for (const o of options) {
      o.credit += o.weight;
      if (o.credit > pick.credit) pick = o;
    }
    pick.credit -= sum;
    parts[Math.floor(pick.lane / LANES_PER_SEAT)].push({ ...note, lane: pick.lane % LANES_PER_SEAT });
  }
  return parts.map((notes) => ({ ...song, notes }));
}
