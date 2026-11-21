// Splits one song across 1 to 4 seats. Pure logic, no browser calls.
// Every seat plays the whole song at the same time. The seats share one keyboard, balanced by notes: each pitch
// takes a width equal to its share of the notes, laid out low to high from the left, so every lane gets about the
// same number of notes. A lone player has 2 lanes (one for each foot). With 2 to 4 players each has ONE lane and
// either foot plays it, so the keyboard has 2, 3 or 4 lanes in all and nobody gets a thinned-out part. A pitch
// that sits inside one lane sends all its notes there. A pitch that crosses lanes shares its notes between them
// in proportion to its width in each, in time order, so the notes alternate between neighbouring lanes.
// The lanes in one pad when `taken` seats are playing (with none taken it is a lone player's pad).
export const lanesInPad = (taken) => (taken >= 2 ? 1 : 2);
const EPS = 1e-9; // widths are floats, so a pitch that ends exactly on a lane edge must not leak into the next lane

// Returns `seats` songs, each the same song with only the notes of that seat's lanes. Each note carries its own
// `lane` on that seat's pad: 0 or 1 for a lone seat, always 0 with two or more. The song's backing is kept on every part.
export function splitParts(song, seats) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    throw new Error(`A song can be split for 1 to 4 players, not ${seats}.`);
  }
  const perSeat = lanesInPad(seats);
  const lanes = seats * perSeat;
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
    parts[Math.floor(pick.lane / perSeat)].push({ ...note, lane: pick.lane % perSeat });
  }
  return parts.map((notes) => ({ ...song, notes }));
}
