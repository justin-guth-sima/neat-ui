import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { DOT_FRAME_PROBE } from '@bench/diagram-seam';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';
import { DotProbeBuffer } from './measure/dot-probe';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs, because the board serves the built bench from a plain static server
    // (`python3 -m http.server`), which answers a deep path such as /kit with a 404.
    provideRouter(routes, withHashLocation()),
    provideNeatTitles('neat-ui bench'),
    provideNeatUi(),
    // One buffer for the whole run, which the dot layer of whichever host is drawn calls once per
    // frame (design 1.3); the run reads it at each phase's end.
    { provide: DotProbeBuffer, useFactory: () => new DotProbeBuffer() },
    { provide: DOT_FRAME_PROBE, useFactory: () => inject(DotProbeBuffer).record },
  ],
};
