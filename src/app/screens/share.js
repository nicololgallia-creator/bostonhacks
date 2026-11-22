// Screen 7: "Good job! Share your game?" The picture of the game is the hero. Share opens the phone's share sheet with the
// picture as a file where the browser allows it (it needs https and a browser that shares files); everywhere else the button
// is "Save image". There is no button for a thing this phone cannot do. The X skips.
import "./after.css";
import { h, svg, button, skeleton, failure } from "../parts.js";
import { lastResults, APP_NAME } from "../after.js";
import { makeStatsImage } from "../stats-image.js";

const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>';
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M6.5 9.5L12 4l5.5 5.5M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M6.5 10.5L12 16l5.5-5.5M5 20h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FILE_NAME = `${APP_NAME.toLowerCase().replace(/\s+/g, "-")}-game.png`;

// "share" when this browser can share a picture file, else "save".
export const modeFor = (file, nav = navigator) => (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] }) ? "share" : "save");

function save(url) {
  const a = Object.assign(document.createElement("a"), { href: url, download: FILE_NAME });
  document.body.append(a);
  a.click();
  a.remove();
}

export default {
  id: "share",
  step: 4,
  mount(app) {
    const kept = lastResults();
    const skip = button("x", () => app.go("again"), svg(X));
    skip.setAttribute("aria-label", "Skip sharing");
    const body = h("div", "share-body", skeleton(1, "margin-left:0;height:22rem;border-radius:1.5rem"));
    const el = h("div", "flow share", h("div", "top", h("div", "", h("h1", "ask", "Good ", h("span", "hl", "job!")), h("p", "sub", "Share your game?")), skip), body);
    let url = "";

    if (!kept) {
      body.replaceChildren(h("div", "notice", h("h2", "", "No game to share."), h("p", "", "Play a song on the floor first. The picture is made from its scores."), button("btn", () => app.restart(), "Pick a song")));
      return { el };
    }

    const load = () => {
      body.replaceChildren(skeleton(1, "margin-left:0;height:22rem;border-radius:1.5rem"));
      makeStatsImage(kept, app.train, app.id).then(
        (made) => { if (!el.isConnected) return URL.revokeObjectURL(made.url); url = made.url; show(made); },
        (e) => { if (el.isConnected) body.replaceChildren(failure(`The picture could not be made. ${e.message}`, load)); },
      );
    };

    function show({ blob, url: href }) {
      const file = new File([blob], FILE_NAME, { type: "image/png" });
      let mode = modeFor(file);
      const img = h("img", "stats");
      img.src = href;
      img.alt = `Your game: team score ${kept.team.score.toLocaleString("en-US")}${kept.team.grade ? `, grade ${kept.team.grade}` : ""}, on ${kept.song.title}.`;
      const note = h("p", "share-note");
      note.setAttribute("role", "status");
      const act = button("btn", async () => {
        if (mode === "save") return save(href);
        note.textContent = "";
        try {
          await navigator.share({ files: [file], title: APP_NAME, text: `Team score ${kept.team.score.toLocaleString("en-US")} on ${kept.song.title}.` });
        } catch (e) {
          if (e.name === "AbortError") return; // the person closed the share sheet
          mode = "save";
          paint();
          note.textContent = `Sharing did not work here (${e.message || e.name}). Save the image instead.`;
        }
      });
      const paint = () => act.replaceChildren(mode === "share" ? "Share" : "Save image", h("span", "go", svg(mode === "share" ? UP : DOWN)));
      paint();
      body.replaceChildren(h("figure", "hero", img), h("div", "actions", act, note));
    }

    load();
    return { el, destroy: () => url && URL.revokeObjectURL(url) };
  },
};
