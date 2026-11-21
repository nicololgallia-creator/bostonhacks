// Splits one song into parts for 1 to 4 players. Pure logic, no browser calls.
// The melody is cut into phrases, each phrase goes to the seat with the fewest notes so far,
// and the last phrase (the finale) goes to every seat.
import { HOLD_MS } from "./engine.js";

const LONG_NOTE = HOLD_MS / 1000; // a note this long (seconds) ends its phrase
const LONG_REST = 0.6; // a silence this long ends the phrase before it
const MAX_PHRASE = 4; // a phrase that has run this long is closed
const MIN_PHRASE = 2; // a phrase is never closed before it has run this long
const EPS = 1e-9; // beats are floats, so 0.6 s must not come out as 0.5999999

// The song's phrases as [{ from, to }]: from is the first note's index, to is one past the last
// (so notes.slice(from, to) is the phrase). Together they cover every note, in order.
// A phrase ends after a long note, before a long silence, or at 4 seconds, but only once it has
// run 2 seconds: a shorter one runs on into the next. A short tail joins the phrase before it.
export function phrasesOf(song) {
  const sec = 60 / song.bpm;
  const notes = song.notes;
  const phrases = [];
  let from = 0;
  for (let i = 0; i < notes.length; i++) {
    const end = (notes[i].beat + notes[i].beats) * sec;
    const ran = end - notes[from].beat * sec;
    const isLast = i === notes.length - 1;
    const wantsEnd =
      isLast || notes[i].beats * sec >= LONG_NOTE - EPS || notes[i + 1].beat * sec - end >= LONG_REST - EPS || ran >= MAX_PHRASE - EPS;
    if (wantsEnd && (isLast || ran >= MIN_PHRASE - EPS)) {
      phrases.push({ from, to: i + 1 });
      from = i + 1;
    }
  }
  const tail = phrases.at(-1);
  if (phrases.length > 1) {
    const ran = (notes[tail.to - 1].beat + notes[tail.to - 1].beats - notes[tail.from].beat) * sec;
    if (ran < MIN_PHRASE - EPS) {
      phrases.pop();
      phrases.at(-1).to = tail.to;
    }
  }
  return phrases;
}

// Returns `seats` songs (1 to 4). Each is the same song with only that player's notes.
// Each phrase before the finale goes to the seat with the fewest notes so far. A tie goes to the
// seat that has waited longest since its last phrase, then to the lowest seat.
export function splitParts(song, seats) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    throw new Error(`A song can be split for 1 to 4 players, not ${seats}.`);
  }
  if (seats === 1) return [{ ...song, notes: song.notes.slice() }];
  const phrases = phrasesOf(song);
  const finale = phrases.pop();
  const mine = Array.from({ length: seats }, () => []);
  const count = new Array(seats).fill(0);
  const lastPhrase = new Array(seats).fill(-1); // index of the seat's latest phrase
  phrases.forEach((p, i) => {
    let pick = 0;
    for (let s = 1; s < seats; s++) {
      if (count[s] < count[pick] || (count[s] === count[pick] && lastPhrase[s] < lastPhrase[pick])) pick = s;
    }
    mine[pick].push(p);
    count[pick] += p.to - p.from;
    lastPhrase[pick] = i;
  });
  return mine.map((own) => {
    const notes = [...own, ...(finale ? [finale] : [])].flatMap((p) => song.notes.slice(p.from, p.to));
    return { ...song, notes };
  });
}
