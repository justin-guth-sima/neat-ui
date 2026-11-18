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
 * A page's aside as an inspector, which the toggle in the top bar opens and closes.
 *
 * The panel is a column of a title, actions, headings, notes and details. The body narrows beside
 * it, and each scrolls on its own.
 *
 * `[(asideWidth)]` is the panel's width, which the page only exposes. Here the text below shows it,
 * and the toolbar's button resets it to the default. Try dragging the line on the panel's left
 * edge, or focus it and use the arrow keys, Home and End.
 *
 * @page
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
  templateUrl: './1-source-panel.example.html',
})
export class SourcePanel {
  protected readonly asideOpen = signal(true);
  protected readonly asideWidth = signal<number | null>(null);
  protected readonly notes = Array.from({ length: 30 }, (_, index) => index + 1);
}
