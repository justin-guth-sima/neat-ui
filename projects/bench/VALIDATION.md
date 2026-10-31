# Validation of the bench on the laptop

What was checked before any board run, with the numbers, what passed and what did not. Raw result
files and traces are in `projects/bench/results/` (gitignored); the file names below are theirs.
Design: insight-next `docs/superpowers/specs/2026-10-31-bench-design.md`, sections 1.4, 2.3 and 2.4.

## Setup

- Machine: Intel Core Ultra 7 258V (8 cores), 32 GB, Intel graphics (Mesa, GPU compositing and
  rasterisation on), Linux, Wayland session with XWayland, on mains power, CPU governor
  `powersave` (the default).
- Browser: Playwright's Chromium 156.0.8078.4, **headed** (a real window), 1920×1080 CSS px at
  DPR 1, refresh measured at 60 Hz.
- **Every measured run below was headed.** Nothing here was measured headless; only the screenshots
  of the results view were taken headless (the view needs no frame accuracy).
- The laptop was not quiet: other applications were open (a screen recorder among them) and the
  load average was about 3.4 before the runs. Repeat spreads below include that noise. No CPU
  frequency or temperature was recorded (the probes read the board over `--ssh`).
- Builds: `npm run bench:build` from a clean tree, commit `1243aea` (campaigns 1 to 4) and `675c97f`
  (the confirmation run). The harness code of each campaign is that commit's, except that `fa464da`
  (the `none` host left out of the recorder check) came in after campaign 1.

| Campaign | Command (all with `--cooldown 5` to `10`) | File |
| --- | --- | --- |
| 1 spread and trace | `--ladders A --renderers kit,vflow,none --repeats 3 --trace --trace-steps 6` | `…-laptop-validation-mvw73muw.json` |
| 2 CDP input | `--ladders A --renderers kit,vflow --repeats 3 --input=cdp` | `…-laptop-validation-cdp-mvw7s5j3.json` |
| 3 smoke | `--ladders B,C,D --renderers kit,vflow,none --repeats 1 --steps 2` | `…-laptop-smoke-mvw84ked.json` |
| 4 soak | `--ladders E --renderers kit --repeats 1` | `…-laptop-smoke-soak-mvw8bn32.json` |
| 5 confirmation | `--ladders A --renderers kit,vflow,none --repeats 1 --trace --trace-steps 6` | `…-laptop-confirm-mvw8wsag.json` |

## Summary

| Check | Result |
| --- | --- |
| 1a Recorder against trace, kit | **Pass**: every gesture phase within 1.5 % (limit 3 %) |
| 1b Recorder against trace, vflow | **Fail**: the recorder reads 5 to 30 % above what the display drew |
| 1c Recorder against trace, none | Not checkable (it draws nothing a gesture moves); left out |
| 2 In-page against CDP input | **Fail** at the knee, explained: the CDP path delivers fewer events |
| 3 Repeat spread under 10 % | **Pass**: fps spread at most 4.4 %; capacities agree to a step |
| 4 Smoke of every ladder on every host | **Pass** (ladders B to D for two steps; E in full) |

Two findings change how results are read (1b and 2); both are for Justin to rule on before the
board runs.

## 1. Recorder against a trace (design 1.4: within 3 %)

**Method.** A traced run (`--trace`) covers the whole page run. The harness now checks it itself
(`harness/trace-check.mjs`, run by `page-run.mjs`): for each pan and zoom phase it counts the
display compositor's draws (`Display::DrawAndSwap`) in the phase's window and compares the rate
with the rate the page's recorder reported. The window is the browser clock at the phase's two
boundary events (the CDP `Timestamp`, which is the trace's clock; the result keeps it as
`cdp.fromS` and `cdp.toS`). A disagreement over 3 % becomes a warning on the campaign; a run whose
trace cannot be read gets a note, never a failed run.

Two choices the trace forced, both written into the module's comments:

- **Draws, not `PipelineReporter` states.** Under this Wayland session every renderer frame ends in
  the state "dropped" while the display draws each of them, so the reporter's verdict (presented or
  dropped) cannot be used here. The display's own draws are the frames that reached the screen.
- **Pan and zoom only.** The display draws a frame only where something changed, and an idle or held
  phase changes nothing for many frames, so fewer draws than rAF frames there says nothing about
  the recorder. A pan or a zoom changes the view in every frame. The `none` host is an empty box:
  no gesture moves a pixel, so the display drew nothing in its pan and zoom (campaign 1: 0 draws
  against 60 fps recorded). Its check is skipped, with the reason in the result.

**Kit: pass.** All 12 gesture phases of the six steps (×1 to ×32), campaign 1, display draws per
second against recorded fps: worst -1.4 %, typically -0.5 %. The same on the confirmation run
(worst -1.5 %).

| Step (load) | Pan: recorded → drawn | Zoom: recorded → drawn |
| --- | --- | --- |
| ×1 to ×8 | 60.0 → 59.6 to 59.7 | 60.0 → 59.5 to 59.6 |
| ×16 | 59.7 → 59.0 | 55.0 → 54.7 |
| ×32 | 57.0 → 56.2 | 31.2 → 31.5 |

**vflow: fail.** The recorder says more than the display drew, and the gap grows with load
(campaign 1; the confirmation run gave -5.0 to -27.2 %, the same shape):

| Step (load) | Pan: recorded → drawn | Zoom: recorded → drawn |
| --- | --- | --- |
| ×1 | 60.0 → 57.0 (-4.9 %) | 60.0 → 57.1 (-4.9 %) |
| ×2 | 60.0 → 54.7 (-8.9 %) | 60.0 → 55.1 (-8.2 %) |
| ×4 | 60.0 → 55.0 (-8.3 %) | 60.0 → 53.9 (-10.1 %) |
| ×8 | 60.0 → 55.3 (-7.9 %) | 60.0 → 52.2 (-13.1 %) |
| ×16 | 56.0 → 45.9 (-18.1 %) | 49.1 → 41.1 (-16.3 %) |
| ×32 | 34.0 → 23.7 (-30.2 %) | 28.8 → 21.3 (-25.9 %) |

- Tracing did not cause it: the untraced runs of campaign 1 read 33.6, 34.6 and 36.1 fps for
  vflow's ×32 pan, the traced run 34.0.
- The display's draws for vflow come at gaps of two or three refresh intervals far more often than
  the kit's (whole trace, 207 two-interval and 58 three-interval gaps in 1812 draws, against 75
  and 6 in 2140 for the kit), while the main thread's rAF still fires every refresh.
- **Cause not diagnosed.** The consistent reading is that vflow's view update (a zoom event goes
  through a signal and change detection, in a task of its own) lands in some frames late or merged
  with the next, so rAF fires with nothing new to draw; a compositor that falls behind while the
  main thread does not is the other candidate. A trace with the phase boundaries marked
  (`performance.mark`) would tell them apart.
- **What it means for the comparison.** The recorder's fps overstates what a user sees of vflow
  and not of the kit. Capacities from the recorder therefore favour vflow, so a "kit clearly slower
  than vflow" verdict is conservative and a "not clearly slower" one is weaker than it reads. On
  this laptop both renderers have the same smooth capacity by the recorder (×8), so the rule's
  verdict, "not clearly slower", would survive vflow's numbers being lower, not higher.
- **What is not known.** Whether the board shows the same gap (its compositor is software), and
  the trace's own account of the kit's and vflow's visible rate in the idle and held phases,
  where draws are fewer by design.

## 2. In-page gestures against `--input=cdp` (design 2.3)

Campaigns 1 and 2: kit and vflow, ladder A, three repeats each, mean fps over the step's phases
(median of three), the busiest phase's main-thread share, and the two gesture phases.

| Load | Kit fps in-page → CDP | Kit busy | vflow fps in-page → CDP | vflow busy |
| --- | --- | --- | --- | --- |
| ×1 | 60.0 → 60.0 | 14 → 10 % | 60.0 → 60.0 | 18 → 20 % |
| ×2 | 60.0 → 60.0 | 21 → 13 % | 60.0 → 60.0 | 28 → 27 % |
| ×4 | 60.0 → 60.0 | 37 → 18 % | 60.0 → 60.0 | 53 → 47 % |
| ×8 | 60.0 → 60.0 | 63 → 27 % | 60.0 → 60.0 | 70 → 62 % |
| ×16 | 58.8 → 59.8 (+1.7 %) | 97 → 51 % | 56.4 → 59.2 (+4.9 %) | 97 → 67 % |
| ×32 | 53.6 → 57.5 (+7.2 %) | 99 → 61 % | 46.2 → 53.3 (+15.5 %) | 100 → 83 % |

At ×32 the pan reads 57.7 → 55.4 (kit) and 34.6 → 48.7 (vflow), the zoom 31.2 → 55.0 (kit) and
31.0 → 45.6 (vflow).

**Fail by the design's bar** (same frame statistics within noise; the repeats' own spread is
under 5 %): fps agree wherever both are pinned at 60, and part from ×16 on, with CDP input the
easier load. The busy shares differ already at light load (kit ×8: 63 against 27 %).

**Why, and what it does not show.** The difference is in how many events reach the page, not in
what the page does with one:

- The kit's zoom phase at ×8 makes 121 style recalculations in-page against 42 with CDP input
  (one wheel event per frame against about one per three), at 7.0 and 7.3 ms of style work each.
  The pan phase makes 183 recalculations in both. vflow ×8 is 3.3 against 3.8 ms of script per
  event in the pan and 2.9 against 4.6 in the zoom.
- The CDP bridge awaits the browser's answer to each pointer action and, while it waits, replaces
  a drag by the newer one and adds up wheel turns (`input.coalesced` in the run entries: 590 of
  1948 events for the kit, 740 of 1898 for vflow, of one run each). So the CDP path is
  closed-loop: the busier the page, the fewer events it is sent, which is why its numbers are
  better exactly at the knee. The in-page driver is one event per frame at any load.
- Conclusion: the in-page driver is not shown to be wrong; the CDP path is not a like-for-like
  load. Keep `--input=page` as the measurement and use `--input=cdp` to show that the page handles
  the browser's own input the same way per event. Over a tunnel to the board its round trips are
  longer still.

## 3. Repeat spread (design 2.4: flag over 10 %)

Campaign 1, in-page input, three repeats per step. Spread = (max - min) / median.

- **Mean fps: at most 4.4 %** (vflow ×16; kit ×32 3.3 %, vflow ×32 2.0 %), 0 % at every step below
  the knee. **Pass.**
- **Capacities.** Smooth: ×8 for the kit and for vflow in all three repeats; `none` never failed
  (at least ×32). Usable: vflow ×32 (at least) in all three; the kit ×32 in two repeats and ×16
  in one (its zoom phase fell to 26 fps there). So the capacity spread is one doubling step at
  the knee and nowhere else.
- Informational, not the criterion: p95 frame time spreads 33 % at ×32 (it sits on the boundary
  between one and two refresh intervals, 16.7 and 33.3 ms, so repeats land on either side);
  the busy share spreads up to 13.8 % for the kit (×8) and 6.5 % for vflow, and 23 % for `none`
  where it is 1 % (a quarter of a point).
- The view flags a cell over 10 % on fps; none was flagged in campaign 1.

## 4. Smoke of every ladder on every host

- **A** (campaign 1): kit, vflow and none, six steps (×1 to ×32), three repeats: all 9 runs ended
  at the step cap, none failed.
- **B, C, D** (campaign 3): kit, vflow and none, the first two steps of each, one repeat: all 9
  runs ended at the cap. The fairness preflight passed (34 blocks and 36 edges drawn alike). The
  dot layer drew the same number of dots on all three hosts at every step (B ×50: median 55,
  largest 63; C: 442 and 450; D ×2: 861 and 867), as the same seed should give, and never hit its
  cap. No run had a warning.
- **E** (campaign 4): ten minutes on the kit. All ten one-minute phases read 60.0 fps, p95 16.7 ms,
  nothing dropped, main-thread share 12.5 to 13.2 %, script time 3.17 to 3.29 s a minute, no long
  animation frame. Flat: nothing grows over the ten minutes. The heap was read once, at the end
  (13.1 MB), so heap growth is not assessable from this result (see below).
- Not exercised: the upper steps of B, C and D (to 25 600 msg/s, 128 notes, ×16), `--refine`,
  `vflow-virt` (deferred: the harness refuses it), `--dpr native`, and any run on the board.

## Changes this validation made

- `harness/trace-check.mjs`: the recorder check (above), run for each traced run, its result kept
  in the run entry (`recorderCheck`) and as a campaign warning where it fails.
- `harness/metrics.mjs`: `cdp.fromS` and `cdp.toS` on each phase, the browser clock at its ends.
- The `none` host's check is skipped (`recorderCheck.skipped`), without a warning.
- The results view (`src/app/results/`) shows the campaign's warnings and each traced run's check.

## For the board runs

- Run `--trace` (`--trace-steps 6` or more, so the heavy steps are in it) on every campaign: the
  check is what says whether the recorder can be trusted on that machine, and vflow's numbers need
  it most. Read a vflow capacity beside its warning.
- Decide whether the results should also carry the trace's presented rate per phase (a column
  next to the recorder's fps for traced runs), so the vflow gap is shown instead of warned about.
- Record the heap at each phase end, not only at a step's end, before the soak is run on the board.
- Keep `--input=page`; see 2.
