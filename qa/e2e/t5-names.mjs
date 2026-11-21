// (5) Names: empty, whitespace, 10 characters, emoji, the same name twice, HTML.
import { start, sleep, waitFor, text, shot } from "./lib.mjs";

const t = await start();
const players = () => (t.spy.state?.players ?? []).map((p) => `${JSON.stringify(p.name)}@${p.spotId ?? "-"}`).join(", ");
const submit = async (p, name) => {
  await p.waitForSelector("#name");
  await p.$eval("#name", (e) => { e.value = ""; });
  if (name) await p.type("#name", name);
  await p.click("form.name button[type=submit]");
  await sleep(500);
};
try {
  const stage = await t.stage();
  const a = await t.phone("a"), b = await t.phone("b"), c = await t.phone("c"), d = await t.phone("d");

  await submit(a, "");
  console.log("empty:", (await text(a)).slice(0, 120), "| players:", players() || "none");
  await submit(a, "   ");
  console.log("spaces:", (await text(a)).slice(0, 120), "| players:", players() || "none");
  await submit(a, "Abcdefghijklmnop");
  console.log("16 chars typed, stored:", players(), "| input value kept at:", await a.evaluate(() => localStorage.getItem("pp:name")));
  // a is now in. leave and re-enter with other names
  await a.click("[data-act=leave]"); await sleep(400);
  await submit(a, "😀😀😀😀😀😀");
  console.log("emoji x6 typed:", players());
  await submit(b, "Nico"); await submit(c, "Nico");
  console.log("same name twice:", players());
  await submit(d, "<b>Hi</b><i>x");
  console.log("html typed:", players());
  // seat them all, screenshot the phones and the stage lobby
  for (const [p, s] of [[a, 1], [b, 2], [c, 3]]) { await p.click(`.pad[data-seat='${s}']`).catch((e) => console.log("click fail", e.message)); await sleep(300); }
  await sleep(600);
  await shot(stage, "e1-16-lobby-names");
  await shot(a, "e1-17-emoji-name");
  console.log("a pad text:", await a.$$eval(".pad .who", (els) => els.map((e) => e.textContent).join("|")));
  console.log("d sees:", await d.$$eval(".pad .who", (els) => els.map((e) => e.textContent).join("|")));
  console.log("d innerHTML has <b>:", await d.evaluate(() => /<b>/.test(document.body.innerHTML) && document.querySelectorAll("b").length));

  // raw 20-char tag name through the link: must show as text everywhere
  t.spy.send({ type: "join", clientId: "rawxss0001", name: "<svg onload=top.x=1>" });
  t.spy.send({ type: "join", clientId: "rawlong001", name: "A".repeat(21) });
  await sleep(800);
  console.log("raw players:", players());
  await d.evaluate(() => (window.x = undefined));
  // start a song so results show every name on the phones
  t.spy.send({ type: "claim", clientId: "rawxss0001", spotId: 1 }); // seat taken, refused
  console.log("raw notice:", t.spy.state?.notice);
  // free a seat: c leaves
  await c.click("[data-act=leave]"); await sleep(500);
  t.spy.send({ type: "claim", clientId: "rawxss0001", spotId: 3 });
  await sleep(500);
  await a.click("[data-act=music]"); await a.waitForSelector("[data-songs]"); await a.click("[data-songs]");
  await a.waitForSelector("[data-song]"); await a.click("[data-song='0']"); await a.click("[data-start]");
  await waitFor(() => t.spy.state?.status === "results", 70000, "results");
  await sleep(1200);
  await shot(stage, "e1-18-results-names");
  await shot(b, "e1-19-results-names-phone");
  console.log("xss on phone b:", await b.evaluate(() => ({ x: window.x, svgs: document.querySelectorAll("svg[onload]").length })));
  console.log("results text b:", (await text(b)).slice(0, 300));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }
