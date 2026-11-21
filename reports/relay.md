# relay report

## Done
- `src/link-relay.js` (new): room code, topics, broker list, MQTT relay with 4-second failover. Loaded by dynamic `import("mqtt")`.
- `src/link.js` (rewritten, same `openLink(onMessage, onStatus)` returning `{ send, close }`): picks transports by host, joins local and relay, drops a message that arrives twice, gives the stage an optional third argument `onRelayStatus(up)`, and returns an extra `relayUp()`. Also exports `stageRoom`, `joinHref`, `chooseTransports`, `createLink`.
- `src/stage/main.js`, the only edit outside link files: line 15 (import `joinHref`, `stageRoom`), lines 73 to 77 (third argument to `openLink`), and the block that starts "With a public site address set" (about lines 100 to 120): `PUBLIC_URL`, `relayUp`, `usePublic`, `drawQr` now builds the address with `joinHref`, and `findAddress` draws the QR when only the public address is available.
- `.env.example` (new): `VITE_PUBLIC_URL=` (empty). `.env.local` untouched.
- `package.json`: one dependency, `mqtt ^5.16.1`.
- Tests: `src/link.test.js`, `src/link-relay.test.js` (20 tests): transport choice by host (stage, LAN, hosted, `?link=` override), room shape, topics, stage room kept in storage, a message on both transports handled once, States ignored by a stage, send on every transport with one id, status.

## Which relay and why
Public MQTT broker over wss, `mqtt` npm package. Order: `broker.emqx.io:8084`, then `test.mosquitto.org:8081`, then `broker.hivemq.com:8884`. Each gets 4 seconds to subscribe, then the next one is tried.
All three tested from a real Chrome/Edge page (puppeteer) on this machine, 21 Nov 2026, over wss, no account, no key. 50 messages each, one 3.5 KB message among them, round trip publisher to subscriber:

| Broker | Connect | Median | Worst | Notes |
| --- | --- | --- | --- | --- |
| emqx | 0.8 to 1.2 s | 76 to 164 ms | 225 to 397 ms | 4 minutes 5 s at 3 messages a second: 717 sent, 717 received, 0 disconnects |
| mosquitto | 0.8 to 1.1 s | 90 to 109 ms | 104 to 177 ms | same 4 minute 5 s run: 717 of 717, 0 disconnects |
| hivemq | 0.8 s when it worked | 83 to 94 ms | 111 to 128 ms | Failed with "connack timeout" in 3 of 6 attempts today. Last in the list for that reason. Its 4-minute run did not complete. |

Through the real code (stage to phone over emqx, headless): a State every 500 ms arrives steadily, 21 in 10 s.
Failover checked: first broker a dead address, the code connected to emqx 5.1 s after start (4 s wait plus 1 s connect). This found a bug (a repeating close kept resetting the 4-second timer, so it never moved on). Fixed.

## What I saw in the real run (puppeteer, stage page and a stand-in phone page on the same dev server)
The stand-in phone is a bare page that imports `src/link.js` with `?link=relay&room=<code>`, so it can only use the relay.
- `stage.html?seats=2`: phone received State in about 1.1 s, sent `join` and `claim` seat 2. Phone's next State listed `relay-phone-1` on spot 2.
- `stage.html?demo=1&seats=2` (the asked-for URL): the guests hold both seats, so the claim is refused. The phone received `notice: {"for":"relay-phone-1","text":"That seat is taken."}` over the relay. That is the round trip working, the refusal is the game's rule.
- Relay blocked (Chrome `--host-resolver-rules` that fails every name except localhost; puppeteer request interception does not cover WebSockets, so I used this): a phone on the local link got State and its claim was answered, and the stage's QR address stayed the LAN address `http://10.192.148.62:5173/?room=..&line=..`. No page errors.
- Public address: I built a copy with `VITE_PUBLIC_URL=https://piano.example.app` into a scratch folder and served it with a tiny static server. QR (`canvas.dataset.joinUrl`) started on the LAN address, then switched to `https://piano.example.app/?room=<code>&line=Green-B&dir=1&at=place-bucen&car=2` when the relay connected. With the relay blocked it stayed on the LAN address.

## Found on the way: a message storm on the shared local link
Two stage pages open on one dev server answered each other's States for ever (a stage applies any message, then sends its State, which the other stage applies). I measured 300 to 840 messages a second on the local link while other builders' stage pages were open. Left alone, with the relay on, that would pour onto the public broker. Fix in `link.js`: a stage ignores `state` messages (only stages send them). After it, the stage sends 2 a second. Stage pages loaded before this change (other builders' open tabs) still answer each other until they reload.

## Limits and honest notes
- Brokers are public, shared, free, with no promise of service. Their terms are not something I read or could fetch here: I did not verify any written rate limit. The only evidence is today's tests. EMQX and HiveMQ offer public brokers as demo/test services, so none of them is a service to depend on forever.
- Anyone who knows or guesses a room code can read and send in that room, and a public broker lets anyone subscribe to every topic. The room code is 40 bits and random, so guessing is not realistic, but it is not private from the broker's operator. What flows: State (seat numbers, scores, the train line and stop, the song title), the phone's `join`, `claim`, `here`, `start` and similar, with the phone's random `clientId`. No names, accounts, emails or locations. The `name` field in `join` is optional and the new phone does not send one, so check that it stays that way.
- A State is 535 to 878 bytes with 2 seats, far under 4 KB. Messages over 4096 characters are not sent (same cap as the local server).
- Each message now carries a short `_m` id on the wire. It is stripped before the stage or phone sees the message, so shapes in PLAN.md are unchanged for them.
- QoS 0, no retained messages. A message sent while a page is offline is lost, same as the local link.

## Bundle
The `mqtt` library is its own chunk, `mqtt.esm-*.js`: 345 KB, 106 KB gzipped. It loads only when a relay is opened (a stage always, a hosted phone always, a phone on the laptop's Wi-Fi never). The link code itself is about 3 KB of source (I did not measure the built entry files before and after).

## Checks
- `npm.cmd test`: 350 tests, 348 pass, 0 fail, 1 todo (the known one in taps.test.js).
- `npm.cmd run build` from PowerShell: passes. It rewrote `dist/`.

## Not checked
- The real new phone app in `src/app/` over the relay. I did not touch it and it is being rewritten. It calls `openLink(onMessage, onStatus)` as before, so it needs only the `room` in its address. On a hosted page with no `room` it logs a warning and the relay stays off, so the phone shows "link down".
- A hosted https page for real. A phone on cell data was not tested.
- A broker dying in the middle of a session (only a dead first broker at start).
- The first time `mqtt` is imported, Vite's dev server may optimise it and reload open pages once. Adding `optimizeDeps: { include: ["mqtt"] }` to `vite.config.js` would avoid that (not my file).

## Needs from others
- **Lead, deploy time:** set `VITE_PUBLIC_URL` (the Vercel address, for example `https://platform-piano.vercel.app`) in the environment of the build that makes the stage page, or in `.env.local` on the laptop. It is read when Vite starts, so restart the dev server after setting it. Nothing is secret. Without it the QR holds the laptop address.
- **Phone builder:** the hosted phone needs nothing but the `room` from its address. Do not send `name`. The banner text for "link down" on a hosted phone should say the stage is not reachable (not "check Wi-Fi").
- **Lead:** the stage must be opened on a laptop with internet for the hosted phone to work. The scan shows the public address only when the relay is up, so the QR may change from the LAN address to the public one a second or two after the stage opens. Show the QR after that, or rescan.
- **Lead:** reload any stage tabs opened before this change so they stop answering each other's States.

## Calls I made
- Room appears in the LAN QR address too, so the phone page has it if someone adds `?link=relay`. It costs a few characters.
- Chose broker order by the measurements: hivemq failed to connect in half my attempts, so it is last.
- Role (stage or phone) comes from the page path (`/stage` or `/stage.html`), so `openLink` kept its signature.
