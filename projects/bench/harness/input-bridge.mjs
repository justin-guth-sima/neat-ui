// `--input=cdp` (design 2.3, "cross-check on the laptop"): the page computes the gesture's path
// as a function of time and hands each pointer action to the harness (`window.benchInput`), which
// plays it through Playwright's `page.mouse`: the browser's real input pipeline (CDP
// `Input.dispatchMouseEvent`), the event path a person's mouse takes. Both drivers should give
// the same frame statistics within noise; if they do not, the in-page driver is wrong.
//
// The browser takes one action at a time, over a link that may be a tunnel. Where it falls behind,
// a drag that waited is replaced by the newer one and wheel turns that waited are added up, as a
// real pointer's events coalesce, so a slow link degrades the replay and never makes it queue the
// whole gesture up and play it after the phase. A press and a release are never merged or dropped.

export function createInputBridge(mouse) {
  const pending = [];
  let busy = null;
  const errors = [];
  let played = 0;
  let coalesced = 0;

  async function perform(action) {
    const { kind, x, y } = action;
    if (kind === 'press') {
      await mouse.move(x, y);
      await mouse.down();
    } else if (kind === 'release') {
      await mouse.move(x, y);
      await mouse.up();
    } else if (kind === 'wheel') {
      await mouse.move(x, y);
      await mouse.wheel(0, action.deltaY);
    } else {
      await mouse.move(x, y);
    }
  }

  async function pump() {
    while (pending.length > 0) {
      const action = pending.shift();
      try {
        await perform(action);
        played++;
      } catch (error) {
        // A page that closed ends the replay; the run's own watchdog and result say the rest.
        errors.push(`${action.kind}: ${error.message}`);
      }
    }
    busy = null;
  }

  return {
    push(action) {
      const last = pending.at(-1);
      if (last && last.kind === 'drag' && action.kind === 'drag') {
        pending[pending.length - 1] = action;
        coalesced++;
      } else if (last && last.kind === 'wheel' && action.kind === 'wheel') {
        pending[pending.length - 1] = { ...action, deltaY: last.deltaY + action.deltaY };
        coalesced++;
      } else {
        pending.push(action);
      }
      busy ??= pump();
    },
    settle: () => busy ?? Promise.resolve(),
    get errors() {
      return errors;
    },
    get played() {
      return played;
    },
    get coalesced() {
      return coalesced;
    },
  };
}
