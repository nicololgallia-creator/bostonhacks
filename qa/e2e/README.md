# Demo path check

Run it before every demo, with nothing else open on the server: `node qa/e2e/demo-path.mjs --base http://localhost:4173` (use the built copy, rebuild first with `npm.cmd run build` from PowerShell). It takes about one minute and writes screenshots to `shots/e2e-<step>-<name>.png`.
It plays the real path with a stage page and a phone page: scan, stop, song, seats, Ready, tap tiles with the mouse, results, lobby, a closed phone, a taken seat. Each of the 8 steps prints PASS or FAIL with the reason, and the exit code is 0 only when all pass.
A FAIL means something on the demo path is broken right now: read the reason and open the matching `-FAIL-` screenshot. If step 1 says another stage page is open, close it: the link has no rooms, so every page on one server hears every other, and the run would be unfair.
