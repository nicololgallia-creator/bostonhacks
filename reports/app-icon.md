# app-icon

## Done
- `tools/make-icons.mjs`: draws Nicolo's real `public/mascot/conductor.svg` onto `#4FAF79` (HERO.green in `src/app/lines.js`) with puppeteer-core. It measures his real pixel box and centres on it, so the conductor is whole and fills 70% of the height (about 60% of the width). Run `node tools/make-icons.mjs` again after any change.
- `public/icons/`: `icon-192.png`, `icon-512.png` (rounded corners, transparent outside), `icon-maskable-512.png` (full bleed), `apple-touch-icon.png` (180, opaque, square), `favicon-32.png`.
- `public/favicon.svg`: his own `#body`, `#face` and `#cap` shapes copied out of the real file by the script, cropped with a viewBox, on a rounded green square. No new drawing. `favicon-32.png` is the same crop.
- `public/manifest.webmanifest`: written by the same script. Name and short name come from `APP_NAME` in `src/app/after.js` (the script reads it, so the name is written once). `start_url "/"`, `display "standalone"`, `background_color #FFFFFF` (the page's `--paper`), `theme_color #4FAF79`, three icons with sizes, type and purpose.
- `index.html` head: description, apple-mobile-web-app-capable, mobile-web-app-capable, apple-mobile-web-app-title, svg and png icon links, apple-touch-icon, manifest link. I replaced the old inline green-square data-URI favicon, because it is the old icon and would fight the new one. Title, viewport, color-scheme, theme-color and the stylesheets are untouched.

## How I checked
- `npm.cmd run build` passed. `dist/` holds `favicon.svg`, `manifest.webmanifest` and `dist/icons/*`, all linked from `dist/index.html` with root paths.
- Opened: `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, a circle-mask test of the maskable icon (conductor sits inside the circle, nothing cut), and `favicon.svg` and `favicon-32.png` at 16, 32 and 128 px. All looked right: whole, centred, sharp, right green. At 16 px the tab icon reads as a white head under a blue cap on green.
- Did not open `icon-192.png` on its own. It is the same code path as the 512 and 180 ones.
- Served `dist` with `vite preview --port 4190`: manifest parses, all three icon files exist, and manifest, icons and favicon came back 200 with the right content types. No console errors. Server stopped.

## Not checked
A real iPhone home screen, a real Android install prompt, and the Android maskable shape other than a circle.

## Not done
Nothing on the card.

## Needs from others
- **Lead (index.html and src/app/main.js):** `<meta name="theme-color">` in `index.html` still starts white and `main.js` paints it to the line's colour. The manifest says `#4FAF79` for the installed app's launch bar. Nothing to fix unless you want the first paint green.
- **app.css owner:** nothing needed. No CSS change is needed for the status bar.
- The green tentacle in his drawing is a green line on a green tile. Its black outline carries it, and it is his drawing, so I left it.

## Calls I made
- Where the name "Platform Piano" appears (change all when it changes):
  1. `src/app/after.js` `APP_NAME` (the source; `node tools/make-icons.mjs` then rewrites the manifest `name` and `short_name`).
  2. `index.html` `<title>` and `apple-mobile-web-app-title` (static text, edit by hand).
  3. Also written by others: `src/app/opening.js`, the comment in `src/app/app.css`, `src/tokens.css`, `docs/*.md`.
- I added `mobile-web-app-capable` next to the Apple one, because Chrome on Android now reads that name.
- The manifest has a plain one-line `description` (not asked, but it shows in install prompts).
- Plain icons use a 22% corner radius, close to the iOS shape.
