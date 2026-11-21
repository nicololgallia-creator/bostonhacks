// Shared helpers for the E1 tests: one stage page, any number of phone pages (each in its own
// browser context, so each has its own localStorage and clientId), and a spy that listens on the link.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { launch } from "../../tools/browser.mjs";

export const BASE = "http://localhost:5173";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-e2e-"));
  const browser = await launch({ userDataDir: dir, args: ["--autoplay-policy=no-user-gesture-required"] });
  const errors = []; // every console error and page error, with where it came from
  const watch = (page, who) => {
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${who}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${who} PAGEERROR: ${e.message}`));
  };
  const spy = openSpy();
  return {
    browser, errors, spy, dir,
    async stage(query = "?feet=mouse") {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 880, height: 495 });
      watch(page, "stage");
      await page.goto(`${BASE}/stage.html${query}`, { waitUntil: "load" });
      await sleep(800);
      return page;
    },
    async phone(who, query = "") {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      watch(page, who);
      await page.goto(`${BASE}/${query}`, { waitUntil: "load" });
      await sleep(500);
      page.who = who;
      return page;
    },
    // Messages on the link that did not come from my own phones: another builder testing on the same link.
    async foreign(pages) {
      const mine = new Set();
      for (const p of pages) mine.add(await p.evaluate(() => localStorage.getItem("pp:clientId")));
      return spy.seen.filter((m) => !m.clientId || !mine.has(m.clientId)).map((m) => `${m.type}:${m.clientId ?? "no-id"}`);
    },
    async close() {
      spy.close();
      try { await browser.close(); } catch { /* already gone */ }
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* best effort */ }
    },
  };
}

// A Node client on the link. Keeps the latest State the stage sent, and every other message it saw.
export function openSpy() {
  const spy = { state: null, states: 0, seen: [], ws: null };
  const connect = () => {
    spy.ws = new WebSocket(`ws://localhost:5173/link`);
    spy.ws.on("message", (d) => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === "state") { spy.state = m; spy.states++; spy.stateAt = Date.now(); } else spy.seen.push(m);
      } catch { /* ignore */ }
    });
    spy.ws.on("error", () => {});
  };
  connect();
  spy.send = (m) => spy.ws.readyState === 1 && spy.ws.send(JSON.stringify(m));
  spy.close = () => { try { spy.ws.close(); } catch { /* ignore */ } };
  return spy;
}

export async function waitFor(fn, ms = 5000, what = "condition") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(100);
  }
  throw new Error(`Timed out after ${ms} ms waiting for ${what}`);
}

export const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
export const shot = (page, name) => page.screenshot({ path: path.resolve("shots", `tester-1-${name}.png`) });

// Join with a name, then claim a seat, as a stranger would, through the page.
export async function joinAndSit(page, name, seat) {
  await page.waitForSelector("#name", { timeout: 4000 });
  await page.type("#name", name);
  await page.click("form.name button[type=submit]");
  await page.waitForSelector(".pad[data-state=open]", { timeout: 4000 });
  await page.click(`.pad[data-seat="${seat}"]`);
  await waitFor(() => page.evaluate((s) => document.querySelector(`.pad[data-seat="${s}"]`)?.dataset.state === "mine", seat), 3000, `seat ${seat} mine`);
}

export function report(rows) { for (const r of rows) console.log(r); }


