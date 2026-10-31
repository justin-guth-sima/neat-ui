import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs, because the board serves the built bench from a plain static server
    // (`python3 -m http.server`), which answers a deep path such as /kit with a 404.
    provideRouter(routes, withHashLocation()),
    provideNeatTitles('neat-ui bench'),
    provideNeatUi(),
  ],
};
