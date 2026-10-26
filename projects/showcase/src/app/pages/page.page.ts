import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  NeatAsideActions,
  NeatAsideHeading,
  NeatAsidePanel,
  NeatAsideTitle,
  NeatAsideToggle,
  NeatButton,
  NeatCode,
  NeatNote,
  NeatPage,
  NeatPageToolbar,
} from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

@Component({
  selector: 'app-page-page',
  imports: [
    NeatAsideActions,
    NeatAsideHeading,
    NeatAsidePanel,
    NeatAsideTitle,
    NeatAsideToggle,
    NeatButton,
    NeatCode,
    NeatDetails,
    NeatNote,
    NeatPage,
    NeatPageToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *neatPageToolbar>
      <neat-aside-toggle [(open)]="asideOpen" />
    </div>

    <neat-page [aside]="asideOpen() ? 'open' : 'closed'" [(asideWidth)]="asideWidth">
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Page</h2>
          <p>
            <code>neat-page</code> fills the shell's content area and owns the one scroll context
            below it. This page is longer than any screen on purpose: the shell, the top bar and the
            rail stay put while only this body scrolls.
          </p>
          <p>
            It also insets its content by the kit's page spacing, so pages line up across apps;
            <code>padding="none"</code> lets full-bleed content such as a video grid reach the
            edges.
          </p>
          <p>
            The page's own controls go to the top bar with <code>*neatPageToolbar</code>; in kiosk
            mode they float beside the exit control while the pointer moves. Its side panel goes
            into <code>[neatPageAside]</code> and shows while <code>aside="open"</code>: the body
            narrows beside it, and each scrolls on its own. The top bar's
            <code>neat-aside-toggle</code> opens and closes it: one button on every page, named
            "Side panel" unless the page says otherwise, with <code>[(open)]</code> the page's own
            state. Inside, <code>neatAsidePanel</code>, <code>neatAsideTitle</code>,
            <code>neatAsideHeading</code>, <code>neatAsideActions</code> and
            <code>neatCode</code> draw the panel's parts the same way everywhere.
          </p>
          <p>
            Beside the body the panel is resizable: drag the line on its left edge, or focus it and
            press the left or right arrow (16 px a step), Home or End; a double click restores the
            default. <code>[(asideWidth)]</code> is the width in pixels (<code>null</code> for the
            default, now {{ asideWidth() ?? 'null' }}): the page only exposes it, and the app keeps
            it where it likes. The panel stays between 18rem and 48rem or 60 % of the page.
          </p>
        </section>
        @for (section of sections; track section) {
          <section class="showcase-section">
            <h3>Section {{ section }}</h3>
            <p>
              Content like this belongs to the page, not to the shell. It never measures the shell's
              size and never sets a height, so the same page works in a small window, on a wall
              display and in kiosk mode, where the rail and the top bar are gone and the page gets
              the whole viewport.
            </p>
            <p class="showcase-muted">
              A page that needs more than one independently scrolling region beyond its side panel
              is a kit change, not a workaround: raise it so the layout becomes a supported
              component.
            </p>
          </section>
        }
      </div>

      <section neatPageAside neatAsidePanel>
        <h2 neatAsideTitle>src3</h2>
        <div neatAsideActions>
          <button neatButton type="button" size="small">Start</button>
          <button neatButton type="button" variant="outlined" size="small">Change…</button>
        </div>
        <h3 neatAsideHeading>Source</h3>
        <p neatNote>
          The browser publishes the camera to <code neatCode>rtsp://…/src3</code> while this tab is
          open.
        </p>
        <h3 neatAsideHeading>Details</h3>
        <dl neatDetails>
          <dt>URL</dt>
          <dd><code neatCode>rtsp://neat.local:8554/src3</code></dd>
          <dt>Live for</dt>
          <dd>1:02:41</dd>
        </dl>
        <h3 neatAsideHeading>Notes</h3>
        @for (item of asideItems; track item) {
          <p neatNote>
            Panel content {{ item }}. The panel is <code neatCode>--neat-aside-width</code> wide and
            scrolls independently of the page body.
          </p>
        }
      </section>
    </neat-page>
  `,
})
export class PagePage {
  protected readonly asideOpen = signal(true);
  protected readonly asideWidth = signal<number | null>(null);
  protected readonly sections = Array.from({ length: 20 }, (_, index) => index + 1);
  protected readonly asideItems = Array.from({ length: 30 }, (_, index) => index + 1);
}
