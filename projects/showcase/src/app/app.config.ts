import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';
import { DOCS_TOPIC_OF } from './docs/docs-context';
import { partTopicPath } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // The docs page reads its topic and page nav from the route's data and resolvers as inputs.
      withComponentInputBinding(),
    ),
    { provide: DOCS_TOPIC_OF, useValue: partTopicPath(GROUPS) },
    provideNeatTitles('neat-ui showcase'),
    provideNeatUi(),
  ],
};
