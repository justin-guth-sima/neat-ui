import { afterRenderEffect, DestroyRef, inject, NgZone, type Signal } from '@angular/core';
import { ɵreducedMotion } from '@sima/neat-ui';
import { SteadyComet } from './steady-comet';

/**
 * Runs the steady comet on its `layer` while the box renders one (the glow is `steady-comet`): made
 * after a render, outside the zone, sized to the box, running while `working` (the board reads the
 * question or the reply arrives) and paused otherwise, never under reduced motion, where it stands
 * still; sized again when the box changes size, and dropped with the layer or the box. Internal.
 */
export function runSteadyComet(
  layer: Signal<HTMLElement | undefined>,
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
      const element = layer();
      const on = working() && !ɵreducedMotion();
      zone.runOutsideAngular(() => {
        if (!element) return drop();
        if (!comet) {
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
