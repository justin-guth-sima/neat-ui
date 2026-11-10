# Where the board's frame time goes (November 2026)

The board campaigns (`results/SUMMARY-2026-11.md`) left the Modalix below the ladders' floor: at
ladder A x1 (30 blocks, no messages) the kit missed the smooth tier with idle 51 fps, pan 45 and
zoom 19. This note says which thread is the limit, why the idle phase misses frames, and what
the kit can change, with one diagnostic campaign and six experiments on scratch builds.

Board: Modalix DevKit, Cortex-A65 x16, no GPU, Chromium 151.0.7922.137 with software compositing
and software raster, bare X at 1920x1080 60 Hz, page served on the board (`--serve board`).

## The limit

**The display compositor's one thread (`VizCompositorThread` in the GPU process).** Software
compositing redraws every 256x256 content tile under the frame's damage on that thread, at about
2 ms per tile with content (about 30 ns a pixel); background tiles and the dot canvas are cheap.
A frame that damages the whole screen costs about 41 ms there, so at most about 24 fps, and a pan
of the A x1 diagram about 20 ms, so about 45 fps. Raster runs in parallel on the renderer's pool
threads (five to seven busy) and is not the bottleneck by itself; Xorg uses under a third of a
core.

Two kit costs sit on top of that and are removable: the zoom's custom property restyles the
edges' SVG every frame (the zoom's main thread), and the dot layer's full-viewport canvas, once it
has drawn, damages the whole screen on every frame with a dot and stays composited afterwards.

## How it was measured

- `--trace-categories` (new, `2aa07ce`): the traced runs record
  `toplevel,cc,viz,gpu,blink,benchmark,disabled-by-default-devtools.timeline,disabled-by-default-cc.debug`;
  Chromium 151 took them all. One traced step is 4.6 to 7 MB gzipped. These categories slow the
  traced run by about 10 % (kit pan presented 39 fps against 43 with `viz` alone), so the fps and
  the per-thread CPU below come from the untraced run of each campaign, and the traces give the
  per-frame structure.
- Per-thread CPU: a sampler read over ssh from stdin (nothing written on the board) read
  `/proc/<pid>/task/<tid>/stat` of Xorg and every Chromium process five times a second on
  `CLOCK_MONOTONIC`, the clock of the trace and of the phases' CDP timestamps, so each phase's
  window cuts the samples exactly. The process kind comes from its threads (`Compositor`: a
  renderer; `VizCompositorTh`: the GPU process).
- Diagnostic campaign `2026-11-01-modalix-devkit-mvxdeks5` (build `2aa07ce`): ladder A, kit,
  vflow and none, one step, one repeat, traced. Experiments: the same, kit only.
- Run-to-run spread, from the four earlier campaigns at A x1: kit idle 51.1 to 52.3 fps, pan 44.1
  to 45.2, zoom 18.0 to 19.3 (recorder). A difference under 2 fps is noise.

## Q1: CPU per thread, per phase (A x1, untraced, baseline build)

ms of CPU per second of wall time (1000 = one core busy), then ms per recorded frame.

| Host, phase | fps rec/pres | renderer main | compositor | raster (all) | viz        | Xorg       |
| ----------- | ------------ | ------------- | ---------- | ------------ | ---------- | ---------- |
| kit idle    | 51.1 / -     | 75 (1.5)      | 25 (0.5)   | 11 (0.2)     | 225 (4.4)  | 89 (1.7)   |
| kit pan     | 44.8 / 39.3  | 307 (6.9)     | 129 (2.9)  | 914 (20.4)   | 971 (21.7) | 261 (5.8)  |
| kit zoom    | 18.5 / 16.6  | 661 (35.7)    | 105 (5.7)  | 1416 (76.5)  | 844 (45.6) | 222 (12.0) |
| vflow idle  | 56.7 / -     | 61 (1.1)      | 21 (0.4)   | 7 (0.1)      | 61 (1.1)   | 25 (0.4)   |
| vflow pan   | 33.3 / 23.1  | 892 (26.8)    | 100 (3.0)  | 867 (26.0)   | 642 (19.3) | 171 (5.1)  |
| vflow zoom  | 19.2 / 15.3  | 683 (35.6)    | 89 (4.6)   | 1221 (63.7)  | 894 (46.6) | 222 (11.6) |
| none idle   | 60.0 / -     | 118 (2.0)     | 29 (0.5)   | 0            | 132 (2.2)  | 196 (3.3)  |
| none pan    | 60.0 / -     | 29 (0.5)      | 11 (0.2)   | 0            | 14 (0.2)   | 0          |

Presented rates are from the wide-category traced run. The GPU process's main thread and its
16 `llvmpipe` threads stay at 0 in every phase; the browser process uses at most 0.1 core.

What is on a frame's critical path:

- **kit pan: viz.** It is busy 97 % of a core (90 % occupancy in the trace) at 20 to 22 ms per
  draw; the main thread needs 7 ms a frame and raster 21 ms of CPU spread over five threads (25 %
  wall occupancy). Every pan frame repaints and re-rasters the visible diagram (13.4 tiles a
  draw), because the moved container is not a composited layer (Q3); that work is parallel and
  off the critical path.
- **kit zoom: main thread, then raster, then viz, in series.** Per draw: `Document::recalcStyle`
  23 ms (170 SVG elements restyled, because `--diagram-zoom` changes on the edges' SVG), paint
  7 ms, re-raster of 23 tiles (72 ms CPU), and a viz draw of 42 ms with most of the screen
  damaged. Main 76 % and viz 79 % occupancy: the frame waits on both.
- **vflow pan: main thread** (98 % occupancy): paint 18 ms, pre-paint 7, layout 3 a frame. vflow
  zoom: main and viz together, as the kit's.
- **Dot frames (any host with a dot moving): viz.** The dot canvas fills the viewport, so a frame
  with a dot damages the whole screen: the kit's draw is 41 ms (40 tiles plus the canvas), vflow's
  41 ms, the empty host's 10 ms (one background quad, 1.4 ms, and the canvas quad, 7.9 ms). The
  main thread adds 6.7 ms a frame copying the 1920x1080 canvas out (`ProduceCanvasResource`).
  This is why ladders B and D read about 23 fps idle on the board for the kit and vflow alike
  (`mvwcx2cc`: B at 50 msg/s kit 23.5, vflow 23.7, none 60.0).

## Q2: why the idle phase misses frames

**There are dots in it.** The page shows the host before the climb sets the first step
(`auto-run.ts`: calibrate, `showHost`, then the phase driver's `apply`), and a host first draws
`DEFAULT_STEP`, D1 at 400 msg/s (`bench-load.ts`). Its feed pushes a first batch at once; ladder
A's step then sets 0 msg/s, but the dots already sent keep traveling, with their step dots, for
about 3.9 s after the build. The warm-up is 3 s, so they run into the first 0.7 to 1 s of the idle
phase at about 22 fps (each frame a 41 ms viz draw, above), and the phase averages 51 fps. vflow
and the empty host carry the same dots (all three draw the kit's dot layer): vflow loses
fewer of its idle frames (57 fps; not followed further), the empty host's frames are cheap
(60 fps).

- The messaging layer's frame loop does stop at 0 msg/s: after the last dot, the main thread runs
  only the recorder's rAF (0.5 to 0.6 ms a frame, the same in every host) and the rate cards'
  12.5 Hz tick; the display draws about once a second on small damage (13 ms), likely the rate
  cards' history moving on a second. Nothing else invalidates paint.
- With hosts that start without messages (E1), the kit's idle phase is 60.0 fps at 4 % main
  thread busy, viz 11 ms/s, and the step draws no dot.
- One more effect of those dots on the later phases: once the dot canvas has drawn, it stays a
  composited layer whose resource is produced again at every commit (1.5 ms main per pan frame)
  and blended under every damaged rect by viz (about 2.5 ms more per pan draw). Hiding the canvas
  while no dot is on its way (E4) gives back pan 45 to 50 fps.

## Q3: zoom re-raster and the pan's layer

- **Zoom re-rasters the whole visible diagram every frame**: 23 tiles a draw (about 1.5 Mpx) of
  the 40 that tile the screen, 72 ms of raster CPU per frame over up to seven threads. The
  container is not composited, so each zoom step repaints the drawing at the new scale and every
  tile with diagram in it changes.
- **Pan: the transformed container (`.content`) is not its own layer.** The compositor's
  transform tree holds only identity nodes during a pan, the tree has 4 layers and one visible
  picture layer, and each pan frame repaints (2.1 ms) and re-rasters the moved area (13.4 tiles a
  draw, damage about 1165x538). The CDP `LayerTree` domain sent no layer events under headless
  Chromium (laptop, 156), so this comes from the trace's property trees;
  `disabled-by-default-cc.debug` wrote no layer snapshots into the JSON trace either.

## Experiments (board, A x1, kit, untraced fps; presented from the traced run)

Each built from a throwaway branch, never committed to `bench` or the kit. E2a, E2b and E3 are on
top of E1; E4 and E3+E4 on the baseline.

| Run                 | Change                                   | idle | pan rec/pres | zoom rec/pres | main busy idle/pan/zoom | viz ms/s pan/zoom |
| ------------------- | ---------------------------------------- | ---- | ------------ | ------------- | ----------------------- | ----------------- |
| baseline `mvxdeks5` | none                                     | 51.1 | 44.8 / 39.3  | 18.5 / 16.6   | 8 / 29 / 67 %           | 971 / 844         |
| E1 `mvxe12p9`       | hosts start at 0 msg/s (bench)           | 60.0 | 52.0 / 45.8  | 20.3 / 18.6   | 4 / 27 / 73 %           | 960 / 844         |
| E2a `mvxe3zoi`      | `will-change: transform` on `.content`   | 60.0 | 34.1 / 28.5  | 15.0 / 14.4   | 4 / 19 / 57 %           | 960 / 938         |
| E2b `mvxeabax`      | the same, only during a gesture          | 60.0 | 33.5 / 28.9  | 15.4 / 13.7   | 3 / 18 / 58 %           | 950 / 929         |
| E3 `mvxe7mww`       | `--diagram-zoom` set at gesture end only | 60.0 | 49.7 / 45.7  | 25.3 / 23.4   | 3 / 22 / 13 %           | 957 / 972         |
| E4 `mvxegbp6`       | dot canvas hidden while no dot moves     | 52.0 | 49.7 / 45.0  | 20.0 / 18.3   | 8 / 24 / 69 %           | 949 / 844         |
| E3+E4 `mvxej28y`    | both kit changes                         | 51.1 | 49.5 / 47.7  | 24.8 / 22.7   | 8 / 28 / 16 %           | 929 / 966         |

Run names are the result files' (`results/2026-11-01-modalix-devkit-<name>.json`). Zoomed-out
was 54.5 to 59.5 fps everywhere.

- **E2 makes both gestures slower.** It takes raster off the pan (4 ms/s instead of 1053) and the
  main thread's paint, but the single viz thread pays more per pan draw than the raster threads
  saved: 29.8 ms against 20.2, on a smaller damage rect (likely filtered draws of the moved
  layer's tiles at a fractional offset; not verified).
  The zoom still re-rasters (30 tiles a draw) and viz rises to 60 ms a draw. No blur at rest: the
  harness's screenshot shows the same diagram, and on the laptop (Chromium 156, software
  compositing) the diagram at rest after a zoom-in is re-rastered sharp; composited text loses
  LCD (subpixel) antialiasing for grayscale.
- **E3 takes the zoom's main thread from 67 % to 13 % busy** (style recalc gone from the frame)
  and zoom from 19 to 25 fps; zoom is then viz-bound (972 ms/s). Pan's main thread drops a
  little too (the drag's zoom events set the property as well).
- **E4 removes the idle canvas's cost** after dots have run: pan 45 to 50 fps, zoom 18.5 to 20;
  it does nothing for the frames that have dots (idle stays 52).
- Screenshots of every run's last step (`results/<file>-kit-A-r0.png`) show the same diagram as
  the baseline; pixel differences are antialiasing only (E2a about 4,000 pixels, the text's lost
  subpixel antialiasing; the others under 750).

## Kit proposals, ranked by measured effect

1. **Set `--diagram-zoom` once a gesture ends, not on every zoom event** (E3, `zoom.ts`). Zoom
   +6 fps (+30 %), zoom main thread 67 to 13 % busy. Cost: about five lines. Risk: during a
   gesture the edges' hit paths keep the width of the zoom it started at (hover is not in use
   then); a fit animation (programmatic, one start and end per frame) still sets it per frame; a
   programmatic jump during a user's drag ends the "gesture" early, and the old cost comes back
   for the rest of it. An alternative to measure: a hit width that does not restyle 170
   elements when it changes.
2. **Hide the dot canvas while no dot is on its way** (E4, `messages.ts`, `visibility: hidden`
   after the last frame's clear, shown again by the next frame). Pan +5 fps, zoom +1.5 after any
   message traffic has stopped. Cost: two lines. Risk: the first frame after a pause shows the
   canvas again in the same frame it draws, so nothing is lost; a host that styles the canvas's
   `visibility` itself would be overridden.
3. **Do not add `will-change: transform` to the content** (E2): on this board it costs 11 fps of
   pan and 4 of zoom: under software compositing it moves work from the raster threads to the one
   compositor thread. Worth a comment in `diagram.css` so nobody adds it for the GPU laptops.
4. **Unmeasured, the largest lever for ladders B to D: limit the dot canvas's damage.** Every
   frame with a dot damages the whole viewport and costs viz 41 ms (24 fps cap) with the diagram
   under it, against about 20 ms for the pan's damage. Sizing the canvas to the drawing's
   on-screen bounds (or splitting it so damage follows the dots) should bring a dot frame down
   with the damaged area, by the cost model above (about 2 ms per content tile under damage): at
   A x1's start view the diagram covers about half the screen. Cost: the canvas's mapping gets an
   offset and a resize per pan and zoom, more than a two-line change; it also lowers the
   6.7 ms main-thread copy per frame in proportion.

What the kit cannot change: the viz cost per damaged content tile. On this board a pan or zoom of
a diagram that covers most of 1080p stays at about 24 to 45 fps whatever the kit draws; a smaller
display mode, a lower device scale, or GPU compositing would move that floor.

## Also seen

- **vflow's traced run stalled the GPU process for 7 s**: `SharedImageStub::OnDestroySharedImage`
  on `CrGpuMain` and a viz `SoftwareRenderer::DoDrawQuad` both blocked 6975 ms with under 2 ms of
  CPU, at the end of vflow's idle phase (`mvxdeks5`, vflow trace, 936814.1 s). No kit trace
  shows anything over 500 ms on the GPU process. It may be how vflow freezes the page at ladder A
  x16 (the 7b watchdog); not followed further.
- vflow's recorder read 10 % above its presented rate in pan here, as in the campaigns.
