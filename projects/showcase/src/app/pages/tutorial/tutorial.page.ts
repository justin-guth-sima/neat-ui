import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatCode, NeatPage, NeatProse } from '@sima/neat-ui';
import kit from '../../../../../neat-ui/package.json';
import { CodeBox } from '../../docs/code-box';
import { CopyButton } from '../../docs/copy-button';
import type { DocsTutorialFile } from '../../docs/model';
import { TUTORIAL_FILES } from '../../docs/generated/tutorial';
import { STYLES } from '../getting-started.page';

/*
 * The steps' commands, exported for the page's spec. The steps' files are real files under
 * `steps/`, which `docs:emit` reads into `TUTORIAL_FILES`: the build type-checks them and the
 * spec renders them, so the tutorial follows the kit as it changes.
 */

/** The kit's tarball as a release names it, at the kit's own version. */
export const TARBALL = `sima-neat-ui-${kit.version}.tgz`;

/** Step 1: checking Node.js and npm. */
export const CHECK_NODE = `node --version
npm --version`;
/** Step 1, on macOS and Linux: Node.js through nvm. */
export const INSTALL_NODE = `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 24`;
/** Step 2: a new Angular app, served. */
export const NEW_APP = `npx @angular/cli@22 new streams --style=css --ssr=false --defaults
cd streams
npm start`;
/** Step 4: the tarball, downloaded with the GitHub CLI. */
export const DOWNLOAD_KIT = `gh release download v${kit.version} --repo <owner>/neat-ui --pattern '*.tgz' --dir vendor`;
/** Step 4: the tarball, installed. */
export const INSTALL_KIT = `npm install ./vendor/${TARBALL}`;
/** Step 6: the two pages, generated. */
export const GENERATE_PAGES = `npx ng generate component streams
npx ng generate component about`;

/** The picture of what a step shows, under `public/tutorial/`. */
export const pictureOf = (step: string): string => `tutorial/${step}.webp`;

/** The files a step changes, as the reader's app has them. */
export const filesOf = (step: string): readonly DocsTutorialFile[] => TUTORIAL_FILES[step] ?? [];

/**
 * The tutorial: from installing Node.js to a small app on the kit, a list of streams with a search
 * and a side panel, in steps that each end with something to look at. For someone following by
 * hand; the Quick start is for an app that already exists.
 */
@Component({
  selector: 'app-tutorial-page',
  imports: [CodeBox, CopyButton, NeatCode, NeatPage, NeatProse, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #files let-step>
      @for (file of filesOf(step); track file.path) {
        <div class="file">
          <p class="file-name">
            <code neatCode>{{ file.path }}</code>
          </p>
          <app-code-box [code]="file.text" overflow="scroll">
            <app-copy-button codeBoxEnd [text]="file.text" [what]="file.path" />
          </app-code-box>
        </div>
      }
    </ng-template>

    <neat-page>
      <div class="guide" neatProse>
        <p class="lead">
          A first app on the kit, step by step: a list of camera streams with a search and a side
          panel, in the kit's shell. Each step ends with what you should see. It takes about half an
          hour, and needs a terminal, a text editor (such as VS Code) and a web browser. Already
          have an Angular app? The <a routerLink="/getting-started">Quick start</a> is shorter.
        </p>
        <ol class="steps">
          <li>
            <h2>Install Node.js</h2>
            <p>
              Angular and the kit run on Node.js 24, which comes with npm, the tool that installs
              packages. Check whether you have it:
            </p>
            <app-code-box [code]="checkNode" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="checkNode" what="commands" />
            </app-code-box>
            <p>
              If the first line is not <code neatCode>v24</code> followed by more numbers, install
              it. On macOS and Linux, through nvm, which installs Node.js in your home folder (open
              a new terminal between the two lines):
            </p>
            <app-code-box [code]="installNode" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="installNode" what="commands" />
            </app-code-box>
            <p>
              On Windows, download the installer of Node.js 24 from
              <code neatCode>nodejs.org</code> and run it. Then open a new terminal and check again.
            </p>
            <p class="see">
              You should see <code neatCode>v24.</code> and more numbers, then npm's version.
            </p>
          </li>

          <li>
            <h2>Create an Angular app</h2>
            <p>
              In the folder that should hold your app, create one named
              <code neatCode>streams</code>, go into it and start it. The first line downloads
              Angular's tools and installs the app's packages, which takes a minute or two:
            </p>
            <app-code-box [code]="newApp" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="newApp" what="commands" />
            </app-code-box>
            <p>
              Open <code neatCode>http://localhost:4200</code> in your browser. Leave the terminal
              running: the page reloads by itself whenever you save a file. Open the
              <code neatCode>streams</code> folder in your editor.
            </p>
            <figure>
              <img [src]="picture('02-new-app')" alt="Angular's welcome page: Hello, streams" />
              <figcaption>You should see Angular's welcome page.</figcaption>
            </figure>
          </li>

          <li>
            <h2>Say hello</h2>
            <p>
              The page comes from <code neatCode>src/app/app.html</code>. Replace everything in it
              with this, and save:
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '03-hello' }" />
            <figure>
              <img [src]="picture('03-hello')" alt="Hello, Neat in the browser's plain font" />
              <figcaption>
                Your own page, in the browser's plain style. The
                <code neatCode>&lt;router-outlet /&gt;</code> is where pages will go later.
              </figcaption>
            </figure>
          </li>

          <li>
            <h2>Add the kit</h2>
            <p>
              The kit is one file, <code neatCode>{{ tarball }}</code
              >, which your app keeps in its own folder. Download it from the Releases page of the
              kit's repository (ask whoever gave you access to it for the address), into a new
              folder <code neatCode>vendor</code> inside <code neatCode>streams</code>. With
              GitHub's command line tool, <code neatCode>gh</code>, that is:
            </p>
            <app-code-box [code]="downloadKit" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="downloadKit" what="command" />
            </app-code-box>
            <p>Stop the app in its terminal with Ctrl+C, and install the kit:</p>
            <app-code-box [code]="installKit" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="installKit" what="command" />
            </app-code-box>
            <p>
              The kit brings its own stylesheet. In <code neatCode>angular.json</code>, find
              <code neatCode>"styles"</code> under <code neatCode>"build"</code> and put the kit's
              first:
            </p>
            <app-code-box [code]="styles" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="styles" what="styles entry" />
            </app-code-box>
            <p>
              Then tell the app about the kit, in <code neatCode>src/app/app.config.ts</code>:
              <code neatCode>provideNeatUi()</code> sets up the kit, and
              <code neatCode>provideNeatTitles</code> names the browser tab after the app.
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '04-kit' }" />
            <p>Start the app again with <code neatCode>npm start</code>.</p>
            <figure>
              <img [src]="picture('04-kit')" alt="Hello, Neat in the kit's font" />
              <figcaption>The same text, now in the kit's font and colors.</figcaption>
            </figure>
          </li>

          <li>
            <h2>Put the app in the shell</h2>
            <p>
              The shell is every Neat app's frame: the top bar with the app's name, and the rail
              with its pages. Replace <code neatCode>src/app/app.ts</code> and
              <code neatCode>src/app/app.html</code>:
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '05-shell' }" />
            <figure>
              <img [src]="picture('05-shell')" alt="The kit's shell: a top bar and a rail" />
              <figcaption>
                The top bar and the rail with two pages, still empty. Try the moon at the bottom of
                the rail: the dark theme.
              </figcaption>
            </figure>
          </li>

          <li>
            <h2>Add two pages</h2>
            <p>
              Let Angular make a component for each page. Run these in a second terminal, in the
              <code neatCode>streams</code> folder, while the app keeps running in the first:
            </p>
            <app-code-box [code]="generatePages" overflow="scroll">
              <app-copy-button codeBoxEnd [text]="generatePages" what="commands" />
            </app-code-box>
            <p>
              Replace their <code neatCode>.ts</code> and <code neatCode>.html</code> files, and
              give each page its address in <code neatCode>src/app/app.routes.ts</code>.
              <code neatCode>neat-page</code> lays a page out in the shell.
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '06-pages' }" />
            <figure>
              <img [src]="picture('06-pages')" alt="The About page in the shell" />
              <figcaption>
                Each rail item opens its page, and its title shows in the top bar and the browser
                tab.
              </figcaption>
            </figure>
          </li>

          <li>
            <h2>List the streams</h2>
            <p>
              A few made-up streams, in the kit's select list: one row each, with a status chip for
              its state. Replace the Streams page's files, and add its stylesheet, which lets the
              list fill the page:
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '07-list' }" />
            <figure>
              <img [src]="picture('07-list')" alt="A list of five streams, one selected" />
              <figcaption>Click a row, or move with the arrow keys.</figcaption>
            </figure>
          </li>

          <li>
            <h2>Search them</h2>
            <p>
              A search field above the list. What is typed in it filters the list, and its status
              line says how many streams are left:
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '08-search' }" />
            <figure>
              <img [src]="picture('08-search')" alt="The search mp4 keeping two streams" />
              <figcaption>
                Type <code neatCode>mp4</code>: two streams are left. The cross, or Escape, clears
                the search.
              </figcaption>
            </figure>
          </li>

          <li>
            <h2>Show the picked stream</h2>
            <p>
              The page's side panel shows the picked stream, with a button that starts or stops it.
              <code neatCode>neat-aside-toggle</code> puts the panel's button in the top bar:
            </p>
            <ng-container *ngTemplateOutlet="files; context: { $implicit: '09-panel' }" />
            <figure>
              <img [src]="picture('09-panel')" alt="Front door picked, its details in the panel" />
              <figcaption>
                Pick a stream: its details open beside the list. Stop and Start change its state in
                the list too.
              </figcaption>
            </figure>
          </li>
        </ol>

        <section neatProse aria-labelledby="tutorial-next">
          <h2 id="tutorial-next">Where next</h2>
          <ul>
            <li>
              Every part the kit has, with live examples and their code:
              <a routerLink="/components">Components</a>, and the shell and pages in
              <a routerLink="/layout">Layout</a>.
            </li>
            <li>
              The kit's icons for the rail and buttons: the
              <a routerLink="/theme/icon-finder">Icon finder</a>.
            </li>
            <li>
              Building for production: <code neatCode>npx ng build</code>. Angular warns once its
              first download passes 500 kB, a budget an app on the kit outgrows; raise
              <code neatCode>"maximumWarning"</code> of the <code neatCode>"initial"</code> budget
              in <code neatCode>angular.json</code>, to <code neatCode>"1MB"</code> for example.
            </li>
            <li>
              Working with a coding agent: the note in the
              <a routerLink="/getting-started">Quick start</a> says where the kit's rules for an app
              are.
            </li>
          </ul>
        </section>
      </div>
    </neat-page>
  `,
  styleUrls: ['../guide.css', './tutorial.page.css'],
})
export class TutorialPage {
  protected readonly tarball = TARBALL;
  protected readonly checkNode = CHECK_NODE;
  protected readonly installNode = INSTALL_NODE;
  protected readonly newApp = NEW_APP;
  protected readonly downloadKit = DOWNLOAD_KIT;
  protected readonly installKit = INSTALL_KIT;
  protected readonly styles = STYLES;
  protected readonly generatePages = GENERATE_PAGES;
  protected readonly picture = pictureOf;
  protected readonly filesOf = filesOf;
}
