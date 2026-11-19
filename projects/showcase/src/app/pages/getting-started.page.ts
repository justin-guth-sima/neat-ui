import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatCode, NeatPage, NeatProse } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';
import { GROUPS } from '../docs/topics';

/*
 * The steps' code, exported for the page's spec, which holds it to the kit as it is: the tarball's
 * name, the stylesheet's export, and each part imported from the entry that exports it.
 */

/** Step 1: the vendored tarball, as the kit's README has apps install it. */
export const INSTALL = 'npm install ./vendor/sima-neat-ui-<version>.tgz';

/** Step 2: the kit's providers, configured once in the app's config. */
export const APP_CONFIG = `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNeatUi(), provideNeatTitles('My demo')],
};`;

/** Step 3: the kit's stylesheet in the build's styles, before the app's own. */
export const STYLES = `"styles": ["@sima/neat-ui/styles/neat-ui.css", "src/styles.css"]`;

/** Step 4: the root component, the app in the shell and the toast host beside it. */
export const APP_COMPONENT = `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost } from '@sima/neat-ui/toast';

@Component({
  selector: 'app-root',
  imports: [NeatShell, NeatToastHost, RouterOutlet],
  template: \`
    <neat-shell appName="My demo" [navItems]="navItems">
      <router-outlet />
    </neat-shell>
    <neat-toast-host />
  \`,
})
export class App {
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Overview', icon: 'stats', path: '/overview' },
    { label: 'Media', icon: 'media', path: '/media' },
  ];
}`;

/** Where to go next: each group of the docs, with what it holds. */
const NEXT = GROUPS.map((group) => ({
  label: group.label,
  path: `/${group.id}`,
  holds: (group.topics ?? group.categories).map((each) => each.label).join(', '),
}));

/**
 * How an app starts on the kit, the page the showcase opens on: the package, the providers, the
 * stylesheet and the shell, a note for coding agents, and the way on to the docs. A page of the
 * showcase's own, in no group: Getting started's Quick start, beside its Tutorial.
 */
@Component({
  selector: 'app-getting-started-page',
  imports: [NeatCallout, NeatCode, NeatCodeBlock, NeatPage, NeatProse, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="guide" neatProse>
        <p class="lead">
          An Angular app on <code neatCode>&#64;sima/neat-ui</code> in four steps. The kit is a
          tarball that each app keeps in its repository, so a build never needs the kit's checkout.
          New to Angular or Node.js? The <a routerLink="/getting-started/tutorial">Tutorial</a>
          builds a first app step by step.
        </p>
        <ol class="steps">
          <li>
            <h2>Add the package</h2>
            <p>
              Copy a release's tarball (or the one <code neatCode>npm run pack</code> writes into
              the kit's <code neatCode>dist/neat-ui/</code>) into the app's
              <code neatCode>vendor/</code> folder, commit it, and install it:
            </p>
            <neat-code-block [code]="install" overflow="scroll" copy="install command" />
          </li>
          <li>
            <h2>Provide the kit</h2>
            <p>
              In <code neatCode>app.config.ts</code>: <code neatCode>provideNeatUi()</code> applies
              the stored color scheme before the first render, and
              <code neatCode>provideNeatTitles</code> titles the browser tab
              <code neatCode>My demo · &lt;page&gt;</code> from each route's title.
            </p>
            <neat-code-block [code]="appConfig" overflow="scroll" copy="app config" />
          </li>
          <li>
            <h2>Import the stylesheet</h2>
            <p>
              In <code neatCode>angular.json</code>, the app's build options list the kit's compiled
              stylesheet before the app's own. It holds the theme and every style the kit's parts
              use, so the app needs no Tailwind.
            </p>
            <neat-code-block [code]="styles" overflow="scroll" copy="styles entry" />
          </li>
          <li>
            <h2>Put the app in the shell</h2>
            <p>
              The root component renders <code neatCode>neat-shell</code> with the app's pages in
              its rail (<code neatCode>navItems</code>) and the router outlet inside, and
              <code neatCode>neat-toast-host</code> once, beside the shell, never inside it.
            </p>
            <neat-code-block [code]="appComponent" overflow="scroll" copy="root component" />
          </li>
        </ol>
        <neat-callout heading="For coding agents" [headingLevel]="2">
          The kit's rules for an app, each with its reason, are in the section "Using the kit in an
          app" of <code neatCode>node_modules/@sima/neat-ui/README.md</code>: import UI only from
          the kit, one entry per part, pages in the rail, a page's sub-pages as its rail item's
          children, more in the page nav, never tabs that change the address, the kit's icon names
          and curve names first, and propose a kit change instead of a workaround. Point the agent
          at it before it writes UI. The repository's <code neatCode>AGENTS.md</code> is for working
          on the kit itself.
        </neat-callout>
        <section class="showcase-section" aria-labelledby="next">
          <h2 id="next">Where next</h2>
          <ul class="next">
            @for (group of next; track group.path) {
              <li>
                <a [routerLink]="group.path">
                  <span class="name">{{ group.label }}</span>
                  <span class="showcase-muted">{{ group.holds }}</span>
                </a>
              </li>
            }
          </ul>
        </section>
      </div>
    </neat-page>
  `,
  styleUrls: ['./guide.css', './getting-started.page.css'],
})
export class GettingStartedPage {
  protected readonly install = INSTALL;
  protected readonly appConfig = APP_CONFIG;
  protected readonly styles = STYLES;
  protected readonly appComponent = APP_COMPONENT;
  protected readonly next = NEXT;
}
