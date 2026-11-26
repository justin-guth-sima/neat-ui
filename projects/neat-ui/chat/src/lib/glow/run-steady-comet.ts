import { afterRenderEffect, DestroyRef, inject, NgZone, type Signal } from '@angular/core';
import { ɵreducedMotion } from '@sima/neat-ui';
import { SteadyComet } from './steady-comet';

/**
 * Runs the steady comet on the message box's frame while `chosen` (the glow is `steady-comet`),
 * never under reduced motion: made after a render, outside the zone, running while `working` (the
 * board reads the question or the reply arrives) and paused otherwise, keyed again when the frame
 * changes size, and dropped when another glow is chosen or the box goes. Internal.
 */
export function runSteadyComet(
  frame: Signal<HTMLElement | undefined>,
  chosen: Signal<boolean>,
  working: Signal<boolean>,
): void {
  const zone = inject(NgZone);
  let comet: SteadyComet | null = null;
  let sizes: ResizeObserver | null = null;
  const drop = () => {
    sizes?.disconnect();
    sizes = null;
    comet?.destroy();
    comet = null;
  };
  afterRenderEffect({
    write: () => {
      const element = frame();
      const wanted = chosen() && !!element && !ɵreducedMotion();
      const on = working();
      zone.runOutsideAngular(() => {
        if (!wanted) return drop();
        if (!comet && element) {
          comet = new SteadyComet(element);
          const view = element.ownerDocument.defaultView;
          if (view && typeof view.ResizeObserver === 'function') {
            sizes = new view.ResizeObserver(() => comet?.resized());
            sizes.observe(element);
          }
        }
        comet?.running(on);
      });
    },
  });
  inject(DestroyRef).onDestroy(drop);
}
