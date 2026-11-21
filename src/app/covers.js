// Real album covers, fetched from Apple's public iTunes Search API when the page runs (no key). Nothing is saved
// in the repo. The answer is cached in localStorage, so each song is asked once. No network or no result: null,
// and the page shows a plain tile in the line's colour with the song's first letter.
// `term` is the search text for one well-known recording of the song. Optional per song: without one, title and artist are used.
const COVERS = {
  twinkle: { term: "Twinkle Twinkle Little Star Cocomelon" },
  "mary-lamb": { term: "Mary Had a Little Lamb Super Simple Songs" },
  "row-boat": { term: "Row Row Row Your Boat Super Simple Songs" },
  "happy-birthday": { term: "Happy Birthday to You Sing-Along Super Simple Songs" },
  "london-bridge": { term: "London Bridge Is Falling Down Super Simple Songs" },
  "frere-jacques": { term: "Frere Jacques Cocomelon" },
  saints: { term: "When the Saints Go Marching In Louis Armstrong" },
  "fur-elise": { term: "Fur Elise Beethoven piano Alfred Brendel" },
  "jingle-bells": { term: "Jingle Bells Frank Sinatra" },
  "ode-to-joy": { term: "Ode to Joy Beethoven Symphony 9" },
  "ship-never-returned": { term: "The Ship That Never Returned" },
  greensleeves: { term: "Greensleeves" },
  "sweet-caroline": { term: "Sweet Caroline Neil Diamond" },
  "shipping-up-to-boston": { term: "I'm Shipping Up to Boston Dropkick Murphys" },
  "dirty-water": { term: "Dirty Water The Standells" },
  "more-than-a-feeling": { term: "More Than a Feeling Boston" },
  "seven-nation-army": { term: "Seven Nation Army The White Stripes" },
};

const DAY = 864e5;
const asked = new Map(); // one question per song per page, however many tiles want it

function cached(key) {
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    // an answer stays; "no result" is forgotten after a day in case the search was the problem
    if (hit && (hit.url || Date.now() - hit.at < DAY)) return hit;
  } catch { /* a blocked or full store just means asking again */ }
  return null;
}

async function lookup(song) {
  const key = `pp-cover:${song.id}`;
  const hit = cached(key);
  if (hit) return hit.url;
  const term = COVERS[song.id]?.term ?? `${song.title} ${song.by.split(",")[0]}`;
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`iTunes search answered ${res.status}`);
  const found = (await res.json()).results?.[0]?.artworkUrl100;
  const url = found ? found.replace("100x100", "300x300") : null;
  try { localStorage.setItem(key, JSON.stringify({ url, at: Date.now() })); } catch { /* fine */ }
  return url;
}

// The cover's address for a song, or null. Never throws: a failed search is only "no cover".
export function coverUrl(song) {
  if (!asked.has(song.id)) asked.set(song.id, lookup(song).catch(() => { asked.delete(song.id); return null; }));
  return asked.get(song.id);
}

