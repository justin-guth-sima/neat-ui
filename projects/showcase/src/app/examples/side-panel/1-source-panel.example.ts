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

/**
 * A page's side panel as an inspector: the toggle in the top bar opens and closes it, and the
 * panel is a column of a title, actions, headings, notes and details. The body narrows beside it
 * and each scrolls on its own. `[(asideWidth)]` is the panel's width, which the page only exposes
 * (here in the text below, and reset to the default by the toolbar's button); drag the line on
 * its left edge, or focus it and use the arrow keys, Home and End, to change it.
 */
@Component({
  selector: 'app-source-panel',
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
      <button
        neatButton
        type="button"
        variant="text"
        size="small"
        [attr.aria-disabled]="asideWidth() === null || null"
        (click)="asideWidth.set(null)"
      >
        Reset panel width
      </button>
    </div>
    <!-- Declared beside the toolbar, not in it: the shell draws it at the top bar's right edge. -->
    <neat-aside-toggle [(open)]="asideOpen" />

    <neat-page [aside]="asideOpen() ? 'open' : 'closed'" [(asideWidth)]="asideWidth">
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Side panel</h2>
          <p>The panel's width is {{ asideWidth() ?? 'null, the default' }}.</p>
          <p class="showcase-muted">
            The panel stays between 18rem and the page's width less 20rem, so the body keeps room.
          </p>
        </section>
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
        @for (item of notes; track item) {
          <p neatNote>
            Panel content {{ item }}. The panel is <code neatCode>--neat-aside-width</code> wide by
            default and scrolls independently of the page body.
          </p>
        }
      </section>
    </neat-page>
  `,
})
export class SourcePanel {
  protected readonly asideOpen = signal(true);
  protected readonly asideWidth = signal<number | null>(null);
  protected readonly notes = Array.from({ length: 30 }, (_, index) => index + 1);
}
