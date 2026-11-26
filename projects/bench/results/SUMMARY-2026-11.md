# Bench campaigns, 2026-11 summary

Numbers only; the write-up is Task 7c. One section per campaign, in the order run. Each campaign's
own summary (the results view's markdown, with its not-comparable and how-the-numbers-were-taken
sections) and result file are kept beside the runs, not here. The result files are gitignored.

- Capacity: the largest load that held in every phase of every smaller step too, as the median
  of the repeats (range where they differ). Smooth: p95 frame within 1.25 refresh intervals and at
  most 5 % dropped. Usable: 30 fps or more and p99 within 100 ms. "none" for a renderer is no
  step of the ladder (not even its first) reaching the tier.
- Verdict rule: the kit is clearly slower where its smooth capacity is at least one doubling step
  below vflow's in 2 of 3 repeats. "Neither meets the tier" where too few repeats have either
  renderer meeting the tier for the rule to decide (the board campaigns' rows read so since the
  final review; they were first published as "Not clearly slower").
- Tiers are judged at the lower of the recorder's rate and the display's presented rate where a
  trace gave one (see each campaign's summary).
- The GPU-blocklist variant was skipped: the board has no render node, and its browser already
  composites in software (`gpu_compositing: disabled_software`).

## Campaigns

| Campaign                      | Result file                               | Page loads | Failed | Harness exit |
| ----------------------------- | ----------------------------------------- | ---------- | ------ | ------------ |
| board-headline                | `2026-10-31-modalix-devkit-mvwcx2cc.json` | 48         | 4      | 1            |
| board-soak                    | `2026-10-31-modalix-devkit-mvwg0oi3.json` | 1          | 0      | 0            |
| board-flags-disable-gpu       | `2026-10-31-modalix-devkit-mvwgektd.json` | 4          | 2      | 1            |
| board-flags-raster4           | `2026-10-31-modalix-devkit-mvwgrcgr.json` | 4          | 2      | 1            |
| board-serves-laptop-dpr1      | `2026-10-31-laptop-mvwh4ym4.json`         | 48         | 0      | 0            |
| board-serves-laptop-dprnative | `2026-10-31-laptop-mvwkhkyu.json`         | 48         | 0      | 0            |
| laptop-alone-dpr1             | `2026-10-31-laptop-mvwnus6d.json`         | 48         | 0      | 0            |
| laptop-alone-dprnative        | `2026-10-31-laptop-mvwr6l9p.json`         | 48         | 0      | 0            |

## 1. Board display, headline

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --serve board --machine modalix-devkit --ladders A,B,C,D --renderers kit,vflow,none --repeats 3 --trace --cooldown 20`

- Machine: Chromium 151.0.7922.137, 16 cores, 4 GB
- Display: the window’s own size, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 3 repeats, in-page gestures, seed 1, ladders A, B, C, D
- 3 page loads did not finish

- Machine label `modalix-devkit`, run id `mvwcx2cc`, started 2026-10-31T12:07:58.236Z
- Page served from: board 127.0.0.1
- Board display: HDMI-1 1920x1080 at 60 Hz, display restored
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: disabled_software; rasterization: disabled_software
- Screen 1920x1080, page 1919x1079 at DPR 1, 16 cores
- Board: Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores, 5898 MB
- Recorder against trace (8 traced runs checked): 5 within 3 %, 3 outside (worst 20.1 %)
- Board temperature (max per run): 56.3 to 58.6 C over 48 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Runs flagged as throttled by the harness: none; repeated: none needed
- Failed page loads: vflow A r0, vflow A r1, vflow A r2, vflow A r0 (traced): watchdog: step 4
  (level 16) did not finish in 69000 ms

### Capacity

| Ladder                               | Renderer | Smooth                             | Usable                                             |
| ------------------------------------ | -------- | ---------------------------------- | -------------------------------------------------- |
| A: diagram size                      | kit      | none                               | none                                               |
| A: diagram size                      | vflow    | none                               | none                                               |
| A: diagram size                      | none     | at least ×32 (960 blocks)          | at least ×32 (960 blocks)                          |
| B: messages per second               | kit      | none                               | none                                               |
| B: messages per second               | vflow    | none                               | none                                               |
| B: messages per second               | none     | 200 msg/s (100 msg/s to 200 msg/s) | 400 msg/s                                          |
| C: notes with live rate cards        | kit      | none                               | none                                               |
| C: notes with live rate cards        | vflow    | none                               | none                                               |
| C: notes with live rate cards        | none     | none                               | at least 128 notes (4 notes to at least 128 notes) |
| D: size, messages and notes together | kit      | none                               | none                                               |
| D: size, messages and notes together | vflow    | none                               | none                                               |
| D: size, messages and notes together | none     | none                               | ×1 (30 blocks, 400 msg/s)                          |

### Verdict per ladder

| Ladder                               | Verdict                | Repeats slower | Usable tier            | Kit under 85 % of vflow’s fps |
| ------------------------------------ | ---------------------- | -------------- | ---------------------- | ----------------------------- |
| A: diagram size                      | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |
| B: messages per second               | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |
| C: notes with live rate cards        | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |
| D: size, messages and notes together | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |

### Warnings

- The browser is headed, so the page has its display’s own size: --viewport 1920x1080 is ignored.
- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- vflow A r1 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- vflow A r2 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- kit A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase; 4
  of 12 gesture phases; worst: step 0 zoom, 19.5 fps recorded against 18.3 drawn). Read the
  recorder's numbers for this machine with care.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  8 of 8 gesture phases; worst: step 3 pan, 6.3 fps recorded against 5.0 drawn). Read the recorder's
  numbers for this machine with care.
- kit B r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase; 1
  of 12 gesture phases; worst: step 1 zoom, 14.8 fps recorded against 14.1 drawn). Read the
  recorder's numbers for this machine with care.

## 2. Board display, soak (ladder E, untraced)

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --serve board --machine modalix-devkit --ladders E --renderers kit --repeats 1 --cooldown 20`

- Machine: Chromium 151.0.7922.137, 16 cores, 4 GB
- Display: the window’s own size, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 1 repeats, in-page gestures, seed 1, ladders E

- Machine label `modalix-devkit`, run id `mvwg0oi3`, started 2026-10-31T13:34:45.771Z
- Page served from: board 127.0.0.1
- Board display: HDMI-1 1920x1080 at 60 Hz, display restored
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: disabled_software; rasterization: disabled_software
- Screen 1920x1080, page 1919x1079 at DPR 1, 16 cores
- Board: Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores, 5898 MB
- Board temperature (max per run): 58.9 to 58.9 C over 1 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Runs flagged as throttled by the harness: none; repeated: none needed

### Capacity

| Ladder  | Renderer | Smooth | Usable |
| ------- | -------- | ------ | ------ |
| E: soak | kit      | none   | none   |

### Soak

- kit: Over 10 phases: the frame rate held, the heap grew from 7.0 MB to 12.7 MB.

### Verdict per ladder

Needs the kit and vflow on the same ladder; this file has none.

### Warnings

- The browser is headed, so the page has its display’s own size: --viewport 1920x1080 is ignored.
- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- The board was busy before the campaign (1 min load average 1.12): stop what else runs on it for a
  measurement.

## 3a. Board display, flag variant --disable-gpu (ladder A)

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --serve board --machine modalix-devkit --ladders A --renderers kit,vflow --repeats 1 --trace --cooldown 20 --browser-flags "--disable-gpu"`

- Machine: Chromium 151.0.7922.137, 16 cores, 4 GB
- Display: the window’s own size, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 1 repeats, in-page gestures, seed 1, ladders A
- 1 page loads did not finish

- Machine label `modalix-devkit`, run id `mvwgektd`, started 2026-10-31T13:45:34.177Z
- Extra browser flags: --disable-gpu
- Page served from: board 127.0.0.1
- Board display: HDMI-1 1920x1080 at 60 Hz, display restored
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: disabled_software; rasterization: disabled_software
- Screen 1920x1080, page 1919x1079 at DPR 1, 16 cores
- Board: Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores, 5898 MB
- Recorder against trace (2 traced runs checked): 0 within 3 %, 2 outside (worst 20.3 %)
- Board temperature (max per run): 57.0 to 58.3 C over 4 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Runs flagged as throttled by the harness: none; repeated: none needed
- Failed page loads: vflow A r0, vflow A r0 (traced): watchdog: step 4 (level 16) did not finish in
  69000 ms

### Capacity

| Ladder          | Renderer | Smooth | Usable |
| --------------- | -------- | ------ | ------ |
| A: diagram size | kit      | none   | none   |
| A: diagram size | vflow    | none   | none   |

### Verdict per ladder

| Ladder          | Verdict                           | Repeats slower | Usable tier  | Kit under 85 % of vflow’s fps |
| --------------- | --------------------------------- | -------------- | ------------ | ----------------------------- |
| A: diagram size | Inconclusive (1 of 3 repeats run) | 0 of 1         | Inconclusive | no                            |

### Warnings

- The browser is headed, so the page has its display’s own size: --viewport 1920x1080 is ignored.
- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- The board was busy before the campaign (1 min load average 1.97): stop what else runs on it for a
  measurement.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- kit A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase; 4
  of 12 gesture phases; worst: step 5 pan, 10.5 fps recorded against 9.9 drawn). Read the recorder's
  numbers for this machine with care.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  8 of 8 gesture phases; worst: step 1 pan, 13.1 fps recorded against 10.5 drawn). Read the
  recorder's numbers for this machine with care.

## 3b. Board display, flag variant --num-raster-threads=4 (ladder A)

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --serve board --machine modalix-devkit --ladders A --renderers kit,vflow --repeats 1 --trace --cooldown 20 --browser-flags "--num-raster-threads=4"`

- Machine: Chromium 151.0.7922.137, 16 cores, 4 GB
- Display: the window’s own size, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 1 repeats, in-page gestures, seed 1, ladders A
- 1 page loads did not finish

- Machine label `modalix-devkit`, run id `mvwgrcgr`, started 2026-10-31T13:55:29.883Z
- Extra browser flags: --num-raster-threads=4
- Page served from: board 127.0.0.1
- Board display: HDMI-1 1920x1080 at 60 Hz, display restored
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: disabled_software; rasterization: disabled_software
- Screen 1920x1080, page 1919x1079 at DPR 1, 16 cores
- Board: Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores, 5898 MB
- Recorder against trace (2 traced runs checked): 0 within 3 %, 2 outside (worst 18.8 %)
- Board temperature (max per run): 56.6 to 57.4 C over 4 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Runs flagged as throttled by the harness: none; repeated: none needed
- Failed page loads: vflow A r0, vflow A r0 (traced): watchdog: step 4 (level 16) did not finish in
  69000 ms

### Capacity

| Ladder          | Renderer | Smooth | Usable |
| --------------- | -------- | ------ | ------ |
| A: diagram size | kit      | none   | none   |
| A: diagram size | vflow    | none   | none   |

### Verdict per ladder

| Ladder          | Verdict                           | Repeats slower | Usable tier  | Kit under 85 % of vflow’s fps |
| --------------- | --------------------------------- | -------------- | ------------ | ----------------------------- |
| A: diagram size | Inconclusive (1 of 3 repeats run) | 0 of 1         | Inconclusive | no                            |

### Warnings

- The browser is headed, so the page has its display’s own size: --viewport 1920x1080 is ignored.
- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- The board was busy before the campaign (1 min load average 1.89): stop what else runs on it for a
  measurement.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- kit A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase; 2
  of 12 gesture phases; worst: step 5 pan, 10.7 fps recorded against 9.8 drawn). Read the recorder's
  numbers for this machine with care.
- vflow A r0 failed: watchdog: step 4 (level 16) did not finish in 69000 ms
- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  6 of 8 gesture phases; worst: step 0 pan, 32.6 fps recorded against 26.5 drawn). Read the
  recorder's numbers for this machine with care.

## 4a. Board serves the laptop, DPR 1

Command: `npm run bench:run -- --input=page --ladders A,B,C,D --renderers kit,vflow,none --repeats 3 --trace --cooldown 20 --target local --serve board:10.42.0.68 --ssh sima@10.42.0.68 --machine laptop --dpr 1`

- Machine: Chromium 156.0.8078.4, 8 cores, ANGLE (Intel, Mesa Intel(R) Graphics (LNL), OpenGL ES
  3.2)
- Display: 1920×1080 at DPR 1, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 3 repeats, in-page gestures, seed 1, ladders A, B, C, D

- Machine label `laptop`, run id `mvwh4ym4`, started 2026-10-31T14:06:05.116Z
- Page served from: board 10.42.0.68
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: enabled; rasterization: enabled
- Screen 1920x1080, page 1920x1080 at DPR 1, 8 cores
- Board (probed over ssh, serving the page): Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores,
  5898 MB
- Recorder against trace (8 traced runs checked): 7 within 3 %, 1 outside (worst 22.3 %)
- Board temperature (max per run): 53.9 to 56.1 C over 48 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Laptop during the campaign (561 samples, 10 s apart): CPU frequency, mean over cores per sample:
  lowest 2220 MHz, mean 3594 MHz, highest 4000 MHz; hottest zone max 86 C; load average at the start
  3.52, during 2.4 to 5.5
- Runs flagged as throttled by the harness: none; repeated: none needed

### Capacity

| Ladder                               | Renderer | Smooth                       | Usable                                 |
| ------------------------------------ | -------- | ---------------------------- | -------------------------------------- |
| A: diagram size                      | kit      | ×8 (240 blocks)              | at least ×32 (960 blocks)              |
| A: diagram size                      | vflow    | none                         | ×16 (480 blocks)                       |
| A: diagram size                      | none     | at least ×32 (960 blocks)    | at least ×32 (960 blocks)              |
| B: messages per second               | kit      | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | vflow    | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | none     | 6,400 msg/s                  | at least 25,600 msg/s                  |
| C: notes with live rate cards        | kit      | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | vflow    | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | none     | at least 128 notes           | at least 128 notes                     |
| D: size, messages and notes together | kit      | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | vflow    | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | none     | ×8 (240 blocks, 3,200 msg/s) | at least ×16 (480 blocks, 6,400 msg/s) |

### Verdict per ladder

| Ladder                               | Verdict            | Repeats slower | Usable tier        | Kit under 85 % of vflow’s fps |
| ------------------------------------ | ------------------ | -------------- | ------------------ | ----------------------------- |
| A: diagram size                      | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| B: messages per second               | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| C: notes with live rate cards        | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| D: size, messages and notes together | Not clearly slower | 0 of 3         | Not clearly slower | no                            |

### Warnings

- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- The board was busy before the campaign (1 min load average 1.13): stop what else runs on it for a
  measurement.
- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  12 of 12 gesture phases; worst: step 5 pan, 35.8 fps recorded against 27.8 drawn). Read the
  recorder's numbers for this machine with care.

## 4b. Board serves the laptop, DPR native

Command: `npm run bench:run -- --input=page --ladders A,B,C,D --renderers kit,vflow,none --repeats 3 --trace --cooldown 20 --target local --serve board:10.42.0.68 --ssh sima@10.42.0.68 --machine laptop --dpr native`

- Machine: Chromium 156.0.8078.4, 8 cores, ANGLE (Intel, Mesa Intel(R) Graphics (LNL), OpenGL ES
  3.2)
- Display: 1920×1080 at DPR 1, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 3 repeats, in-page gestures, seed 1, ladders A, B, C, D

- Machine label `laptop`, run id `mvwkhkyu`, started 2026-10-31T15:39:52.806Z
- Page served from: board 10.42.0.68
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: enabled; rasterization: enabled
- Screen 1920x1080, page 1920x1080 at DPR 1, 8 cores
- Board (probed over ssh, serving the page): Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board), 16 cores,
  5898 MB
- Recorder against trace (8 traced runs checked): 7 within 3 %, 1 outside (worst 23.9 %)
- Board temperature (max per run): 54.4 to 54.9 C over 48 runs; the board exposes no CPU frequency,
  so throttling is judged by temperature only
- Laptop during the campaign (562 samples, 10 s apart): CPU frequency, mean over cores per sample:
  lowest 2801 MHz, mean 3589 MHz, highest 4021 MHz; hottest zone max 81 C; load average at the start
  4.11, during 2.3 to 5.6
- Runs flagged as throttled by the harness: none; repeated: none needed

### Capacity

| Ladder                               | Renderer | Smooth                       | Usable                                          |
| ------------------------------------ | -------- | ---------------------------- | ----------------------------------------------- |
| A: diagram size                      | kit      | ×8 (240 blocks)              | at least ×32 (960 blocks) (×16 to at least ×32) |
| A: diagram size                      | vflow    | ×1 (30 blocks)               | ×16 (480 blocks)                                |
| A: diagram size                      | none     | at least ×32 (960 blocks)    | at least ×32 (960 blocks)                       |
| B: messages per second               | kit      | 3,200 msg/s                  | at least 25,600 msg/s                           |
| B: messages per second               | vflow    | 3,200 msg/s                  | at least 25,600 msg/s                           |
| B: messages per second               | none     | 6,400 msg/s                  | at least 25,600 msg/s                           |
| C: notes with live rate cards        | kit      | at least 128 notes           | at least 128 notes                              |
| C: notes with live rate cards        | vflow    | at least 128 notes           | at least 128 notes                              |
| C: notes with live rate cards        | none     | at least 128 notes           | at least 128 notes                              |
| D: size, messages and notes together | kit      | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)                    |
| D: size, messages and notes together | vflow    | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)                    |
| D: size, messages and notes together | none     | ×8 (240 blocks, 3,200 msg/s) | at least ×16 (480 blocks, 6,400 msg/s)          |

### Verdict per ladder

| Ladder                               | Verdict            | Repeats slower | Usable tier        | Kit under 85 % of vflow’s fps |
| ------------------------------------ | ------------------ | -------------- | ------------------ | ----------------------------- |
| A: diagram size                      | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| B: messages per second               | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| C: notes with live rate cards        | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| D: size, messages and notes together | Not clearly slower | 0 of 3         | Not clearly slower | no                            |

### Warnings

- The board exposes no CPU frequency (no cpufreq files): throttling can be judged by temperature
  only, which is recorded per run.
- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  12 of 12 gesture phases; worst: step 5 zoom, 24.6 fps recorded against 18.7 drawn). Read the
  recorder's numbers for this machine with care.

## 5a. Laptop alone, DPR 1

Command: `npm run bench:run -- --input=page --ladders A,B,C,D --renderers kit,vflow,none --repeats 3 --trace --cooldown 20 --target local --machine laptop --dpr 1`

- Machine: Chromium 156.0.8078.4, 8 cores, 32 GB, ANGLE (Intel, Mesa Intel(R) Graphics (LNL), OpenGL
  ES 3.2)
- Display: 1920×1080 at DPR 1, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 3 repeats, in-page gestures, seed 1, ladders A, B, C, D

- Machine label `laptop`, run id `mvwnus6d`, started 2026-10-31T17:14:07.525Z
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: enabled; rasterization: enabled
- Screen 1920x1080, page 1920x1080 at DPR 1, 8 cores
- Recorder against trace (8 traced runs checked): 7 within 3 %, 1 outside (worst 27.4 %)
- Laptop during the campaign (558 samples, 10 s apart): CPU frequency, mean over cores per sample:
  lowest 2840 MHz, mean 3614 MHz, highest 3982 MHz; hottest zone max 84 C; load average at the start
  4.20, during 2.5 to 6.1
- Throttling: the harness has no probe without --ssh, so none was flagged; the laptop samples above
  are the only evidence

### Capacity

| Ladder                               | Renderer | Smooth                       | Usable                                 |
| ------------------------------------ | -------- | ---------------------------- | -------------------------------------- |
| A: diagram size                      | kit      | ×8 (240 blocks)              | at least ×32 (960 blocks)              |
| A: diagram size                      | vflow    | none                         | ×16 (480 blocks)                       |
| A: diagram size                      | none     | at least ×32 (960 blocks)    | at least ×32 (960 blocks)              |
| B: messages per second               | kit      | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | vflow    | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | none     | 6,400 msg/s                  | at least 25,600 msg/s                  |
| C: notes with live rate cards        | kit      | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | vflow    | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | none     | at least 128 notes           | at least 128 notes                     |
| D: size, messages and notes together | kit      | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | vflow    | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | none     | ×8 (240 blocks, 3,200 msg/s) | at least ×16 (480 blocks, 6,400 msg/s) |

### Verdict per ladder

| Ladder                               | Verdict            | Repeats slower | Usable tier        | Kit under 85 % of vflow’s fps |
| ------------------------------------ | ------------------ | -------------- | ------------------ | ----------------------------- |
| A: diagram size                      | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| B: messages per second               | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| C: notes with live rate cards        | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| D: size, messages and notes together | Not clearly slower | 0 of 3         | Not clearly slower | no                            |

### Warnings

- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  12 of 12 gesture phases; worst: step 5 zoom, 31.7 fps recorded against 23.0 drawn). Read the
  recorder's numbers for this machine with care.

## 5b. Laptop alone, DPR native

Command: `npm run bench:run -- --input=page --ladders A,B,C,D --renderers kit,vflow,none --repeats 3 --trace --cooldown 20 --target local --machine laptop --dpr native`

- Machine: Chromium 156.0.8078.4, 8 cores, 32 GB, ANGLE (Intel, Mesa Intel(R) Graphics (LNL), OpenGL
  ES 3.2)
- Display: 1920×1080 at DPR 1, 60 Hz measured, headed
- Build: production build, commit 108e3b4, kit 0.23.0, ngx-vflow 2.7.0
- Run: 3 repeats, in-page gestures, seed 1, ladders A, B, C, D

- Machine label `laptop`, run id `mvwr6l9p`, started 2026-10-31T18:47:17.293Z
- Build sha (as measured): 108e3b48e783fba8b177300fbe1c1f1207b89570; checkout
  108e3b48e783fba8b177300fbe1c1f1207b89570
- GPU compositing: enabled; rasterization: enabled
- Screen 1920x1080, page 1920x1080 at DPR 1, 8 cores
- Recorder against trace (8 traced runs checked): 7 within 3 %, 1 outside (worst 25.0 %)
- Laptop during the campaign (558 samples, 10 s apart): CPU frequency, mean over cores per sample:
  lowest 2371 MHz, mean 3602 MHz, highest 3992 MHz; hottest zone max 86 C; load average at the start
  4.91, during 2.6 to 6.3
- Throttling: the harness has no probe without --ssh, so none was flagged; the laptop samples above
  are the only evidence

### Capacity

| Ladder                               | Renderer | Smooth                       | Usable                                 |
| ------------------------------------ | -------- | ---------------------------- | -------------------------------------- |
| A: diagram size                      | kit      | ×8 (240 blocks)              | at least ×32 (960 blocks)              |
| A: diagram size                      | vflow    | none                         | ×16 (480 blocks)                       |
| A: diagram size                      | none     | at least ×32 (960 blocks)    | at least ×32 (960 blocks)              |
| B: messages per second               | kit      | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | vflow    | 3,200 msg/s                  | at least 25,600 msg/s                  |
| B: messages per second               | none     | 6,400 msg/s                  | at least 25,600 msg/s                  |
| C: notes with live rate cards        | kit      | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | vflow    | at least 128 notes           | at least 128 notes                     |
| C: notes with live rate cards        | none     | at least 128 notes           | at least 128 notes                     |
| D: size, messages and notes together | kit      | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | vflow    | ×4 (120 blocks, 1,600 msg/s) | ×8 (240 blocks, 3,200 msg/s)           |
| D: size, messages and notes together | none     | ×8 (240 blocks, 3,200 msg/s) | at least ×16 (480 blocks, 6,400 msg/s) |

### Verdict per ladder

| Ladder                               | Verdict            | Repeats slower | Usable tier        | Kit under 85 % of vflow’s fps |
| ------------------------------------ | ------------------ | -------------- | ------------------ | ----------------------------- |
| A: diagram size                      | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| B: messages per second               | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| C: notes with live rate cards        | Not clearly slower | 0 of 3         | Not clearly slower | no                            |
| D: size, messages and notes together | Not clearly slower | 0 of 3         | Not clearly slower | no                            |

### Warnings

- vflow A r0: the recorder and the trace disagree by more than 3 % (and one draw, in a short phase;
  12 of 12 gesture phases; worst: step 5 pan, 37.1 fps recorded against 27.8 drawn). Read the
  recorder's numbers for this machine with care.

## 6. Board display with lighter rungs (ladders A and D, ×1/8 to ×1/2 added)

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --serve board --machine modalix-devkit --cooldown 20 --ladders A,D --renderers kit,vflow,none --repeats 3 --trace --out projects/bench/results`

Changes against campaign 1: ladders A (×1/8 to ×32) and D (×1/8 to ×16) start at ×1/8; no host draws
a load before the climb's first step (the default load's dots no longer run into the first idle
phase); the fairness check compares the kit and vflow at ×1.

- Result file `2026-11-01-modalix-devkit-mvxfbsb7.json`, run id `mvxfbsb7`, started
  2026-11-01T06:03:10Z; 24 page loads (18 plus 6 traced), 4 failed, harness exit 1
- Build sha (as measured and checkout): `df0e6a77749727ecd1223aed8f584c05aeaa20ea`, production
  build, kit 0.23.0, ngx-vflow 2.7.0
- Machine: Chromium 151.0.7922.137, Cortex-A65 x16, bare X 1920x1080 at 60 Hz, display restored,
  no `/tmp/neat-bench-*` left, lightdm active
- Fairness check at ×1: passed, 34 blocks and 36 edges drawn alike (DOM nodes: kit 532, vflow 803)
- Board temperature (max per run): 55.5 to 58.0 C over 24 runs; no CPU frequency exposed; runs
  flagged as throttled: none

### Capacity

| Ladder                               | Renderer | Smooth                    | Usable                    |
| ------------------------------------ | -------- | ------------------------- | ------------------------- |
| A: diagram size                      | kit      | none                      | none                      |
| A: diagram size                      | vflow    | none                      | none                      |
| A: diagram size                      | none     | at least ×32 (960 blocks) | at least ×32 (960 blocks) |
| D: size, messages and notes together | kit      | none                      | none                      |
| D: size, messages and notes together | vflow    | none                      | none                      |
| D: size, messages and notes together | none     | none                      | ×1 (30 blocks, 400 msg/s) |

### Verdict per ladder

| Ladder                               | Verdict                | Repeats slower | Usable tier            | Kit under 85 % of vflow's fps |
| ------------------------------------ | ---------------------- | -------------- | ---------------------- | ----------------------------- |
| A: diagram size                      | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |
| D: size, messages and notes together | Neither meets the tier | 0 of 3         | Neither meets the tier | no                            |

### Median fps by level (recorder / presented where a trace gave one, over 3 repeats)

Ladder A, kit and vflow (the kit's idle is 59 to 60 at every level up to ×16):

| Level            | kit pan | kit zoom | kit tier | vflow pan | vflow zoom | vflow tier               |
| ---------------- | ------- | -------- | -------- | --------- | ---------- | ------------------------ |
| ×1/8 (4 blocks)  | 43 / 41 | 19 / 18  | failing  | 43 / 40   | 19 / 18    | failing                  |
| ×1/4 (8 blocks)  | 52 / 51 | 33 / 31  | usable   | 52 / 48   | 33 / 30    | usable                   |
| ×1/2 (15 blocks) | 51 / 49 | 30 / 28  | failing  | 48 / 19   | 30 / 27    | usable, failing, failing |
| ×1 (30 blocks)   | 50 / 49 | 20 / 19  | failing  | 39 / 31   | 22 / 19    | failing                  |

Ladder D (idle / pan / zoom):

| Level                       | kit          | vflow        | none                  |
| --------------------------- | ------------ | ------------ | --------------------- |
| ×1/8 (4 blocks, 50 msg/s)   | 17 / 26 / 15 | 17 / 26 / 15 | 60 / 60 / 60 (usable) |
| ×1/4 (8 blocks, 100 msg/s)  | 24 / 33 / 25 | 24 / 32 / 24 | 60 / 60 / 60 (smooth) |
| ×1/2 (15 blocks, 200 msg/s) | 24 / 31 / 22 | 24 / 30 / 22 | 60 / 60 / 60 (smooth) |
| ×1 (30 blocks, 400 msg/s)   | 24 / 27 / 14 | 23 / 21 / 14 | 45 / 53 / 43 (usable) |

The start view's scale (fit) at A and D: k 1.36 at ×1/8 and ×1/4, 0.94 at ×1/2, 0.60 at ×1 and ×2.

### Warnings

- vflow A r0, r1, r2 and the traced r0 failed: watchdog: step 7 (level 16) did not finish in
  69000 ms (the 7b ×16 freeze, again).
- kit A r0 (traced): recorder and trace disagree by more than 3 % (1 of 18 gesture phases; worst:
  step 8 pan, 11.4 fps recorded against 10.8 drawn).
- vflow A r0 (traced): recorder and trace disagree by more than 3 % (13 of 14 gesture phases;
  worst: step 3 pan, 37.5 fps recorded against 31.1 drawn).
- Kit D r0 and vflow D r0: within 3 % (worst 5.0 % and -2.8 %); the none host is not checked.
- The presented rate decided the tier of: vflow on ladder A at ×1/4.

## 7. Board display at 1280x720 (ladders A and D)

Against section 6 (1920x1080, same ladders and rungs): A ×1 pan 50 / 49 to 60 / 59 for the kit and
39 / 31 to 40 / 39 for vflow, zoom 20 / 19 to 33 / 34 (kit) and 22 / 19 to 29 / 29 (vflow); D at
×1 idle 24 to 48 (kit) and 23 to 41 (vflow); capacities (smooth / usable): A kit none / none to
×1/4 / ×1, A vflow none / none to none / ×1/2, D kit and vflow none / none to none / ×1/2, D
none host ×1/2 / ×2 where it was none / ×1.

Command: `npm run bench:run -- --input=page --target remote --ssh sima@10.42.0.68 --remote-display bare --remote-mode 1280x720 --serve board --machine modalix-devkit --cooldown 20 --ladders A,D --renderers kit,vflow,none --repeats 3 --trace --out projects/bench/results`

Changes against campaign 6: only the bare display's mode (1280x720 at 60 Hz on HDMI-1, not
1920x1080). The page and its ladders are the same, so a level puts the same blocks on the page;
the start view's fit scale is smaller because the box is (k 0.89 at ×1/8 and ×1/4, 0.62 at ×1/2,
0.40 at ×1 and ×2, against 1.36, 0.94 and 0.60), which keeps the diagram's share of the screen.

- Result file `2026-11-01-modalix-devkit-mvxri23v.json`, run id `mvxri23v`, started
  2026-11-01T11:43:58Z; 24 page loads (18 plus 6 traced), 4 failed, harness exit 1
- Build sha (as measured and checkout): `c9523150003c61f5fa8dfccceca2656dbd05fb9f`, production
  build, kit 0.23.0, ngx-vflow 2.7.0
- Machine: Chromium 151.0.7922.137, Cortex-A65 x16, bare X 1280x720 at 60 Hz (HDMI-1), the page
  saw a 1279x719 viewport on a 1280x720 screen (DPR 1), display restored, no `/tmp/neat-bench-*`
  left, lightdm active
- Fairness check at ×1: passed, 34 blocks and 36 edges drawn alike (DOM nodes: kit 532, vflow 803)
- Board temperature (max per run): 55 to 57 C over 24 runs; no CPU frequency exposed; runs
  flagged as throttled: none

### Capacity

| Ladder                               | Renderer | Smooth                      | Usable                               |
| ------------------------------------ | -------- | --------------------------- | ------------------------------------ |
| A: diagram size                      | kit      | ×1/4 (8 blocks)             | ×1 (30 blocks)                       |
| A: diagram size                      | vflow    | none                        | ×1/2 (15 blocks)                     |
| A: diagram size                      | none     | at least ×32 (960 blocks)   | at least ×32 (960 blocks)            |
| D: size, messages and notes together | kit      | none                        | ×1/2 (15 blocks, 200 msg/s)          |
| D: size, messages and notes together | vflow    | none                        | ×1/2 (15 blocks, 200 msg/s)          |
| D: size, messages and notes together | none     | ×1/2 (15 blocks, 200 msg/s) | ×2 (60 blocks, 800 msg/s) (×1 to ×2) |

### Verdict per ladder

| Ladder                               | Verdict                | Repeats slower | Usable tier        | Kit under 85 % of vflow's fps |
| ------------------------------------ | ---------------------- | -------------- | ------------------ | ----------------------------- |
| A: diagram size                      | Not clearly slower     | 0 of 3         | Not clearly slower | no                            |
| D: size, messages and notes together | Neither meets the tier | 0 of 3         | Not clearly slower | no                            |

On A the kit meets the smooth tier (×1/4) and vflow does not, so the verdict is the rule's, with
the kit ahead; on D neither meets smooth, and "not clearly slower" is the usable tier's.

### Median fps by level (recorder / presented where a trace gave one, over 3 repeats)

Ladder A, kit and vflow (idle is 60 at every level they reached; vflow stops at ×8, its ×16
freezing in all four loads):

| Level            | kit pan | kit zoom | kit tier | vflow pan | vflow zoom | vflow tier |
| ---------------- | ------- | -------- | -------- | --------- | ---------- | ---------- |
| ×1/8 (4 blocks)  | 60 / 60 | 60 / 60  | smooth   | 60 / 55   | 60 / 50    | usable     |
| ×1/4 (8 blocks)  | 60 / 60 | 60 / 60  | smooth   | 60 / 55   | 59 / 49    | usable     |
| ×1/2 (15 blocks) | 60 / 60 | 54 / 51  | usable   | 58 / 48   | 49 / 44    | usable     |
| ×1 (30 blocks)   | 60 / 59 | 33 / 34  | usable   | 40 / 39   | 29 / 29    | failing    |
| ×2 (60 blocks)   | 60 / 57 | 15 / 16  | failing  | 23 / 21   | 18 / 18    | failing    |
| ×4 (120 blocks)  | 60 / 57 | 8 / 7    | failing  | 12 / 11   | 9 / 8      | failing    |
| ×8 (240 blocks)  | 46 / 45 | 4 / 5    | failing  | 6 / 5     | 5 / 4      | failing    |
| ×16 (480 blocks) | 27 / 26 | 2 / 2    | failing  | no step   | no step    | failed     |
| ×32 (960 blocks) | 15 / 15 | 2 / 1    | failing  | no step   | no step    | failed     |

The none host holds 60 / 60 / 60 (smooth) at every level to ×32.

Ladder D (idle / pan / zoom):

| Level                       | kit                    | vflow                  | none                                   |
| --------------------------- | ---------------------- | ---------------------- | -------------------------------------- |
| ×1/8 (4 blocks, 50 msg/s)   | 60 / 59 / 44 (usable)  | 60 / 53 / 41 (usable)  | 60 / 60 / 60 (smooth)                  |
| ×1/4 (8 blocks, 100 msg/s)  | 60 / 59 / 52 (usable)  | 60 / 57 / 48 (usable)  | 60 / 60 / 60 (smooth)                  |
| ×1/2 (15 blocks, 200 msg/s) | 59 / 58 / 38 (usable)  | 60 / 45 / 33 (usable)  | 60 / 60 / 60 (smooth)                  |
| ×1 (30 blocks, 400 msg/s)   | 48 / 43 / 19 (failing) | 41 / 23 / 19 (failing) | 57 / 58 / 55 (usable)                  |
| ×2 (60 blocks, 800 msg/s)   | 25 / 21 / 10 (failing) | 20 / 13 / 11 (failing) | 31 / 40 / 36 (usable, usable, failing) |
| ×4 (120 blocks, 1600 msg/s) | 10 / 10 / 4 (failing)  | 8 / 6 / 5 (failing)    | 12 / 15 / 13 (failing)                 |

(Each figure is the lower of the recorder's and the presented median; D's idle has a presented
rate because dots move. A cell's tier is the median of the repeats' tiers, or the repeats' own
where they differ.)

### Warnings

- vflow A r0, r1, r2 and the traced r0 failed: watchdog: step 7 (level 16) did not finish in
  69000 ms (the 7b ×16 freeze, again).
- kit A r0 (traced): recorder and trace disagree by more than 3 % (2 of 18 gesture phases; worst:
  step 5 zoom, 8.0 fps recorded against 7.2 drawn; step 8 zoom is the largest relative gap, -19.4
  %, at 1.7 fps, inside its own allowance).
- vflow A r0 (traced): recorder and trace disagree by more than 3 % (10 of 14 gesture phases;
  worst: step 1 zoom, 60.0 fps recorded against 49.1 drawn).
- kit D r0 (traced): outside 3 % in 1 of 12 gesture phases (worst: step 5 pan, 10.6 fps recorded
  against 10.3 drawn). vflow D r0: within 3 % (worst -2.7 %); the none host is not checked.
- The presented rate decided the tier of: vflow on ladder A at ×1/8 and ×1/4.
- The page's viewport is the display's own size (1279x719): `--viewport 1920x1080` is ignored in a
  headed run, as in section 6.
