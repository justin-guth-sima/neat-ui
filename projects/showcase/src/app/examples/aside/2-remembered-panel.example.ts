import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  NeatAsidePanel,
  neatAsideOpen,
  NeatAsideTitle,
  NeatAsideToggle,
  NeatPage,
  neatStoredSignal,
} from '@sima/neat-ui';

/**
 * A panel whose state is remembered.
 *
 * `neatAsideOpen` takes the remembered choice and the way to write it, here a stored signal. On a
 * wide screen the panel is the remembered choice. On a narrow one it floats over the page and
 * starts closed. What is opened or closed there is not remembered, so a phone never overwrites the
 * choice made on a wide screen.
 *
 * @page
 * @unpictured
 */
@Component({
  selector: 'app-remembered-panel',
  imports: [NeatAsidePanel, NeatAsideTitle, NeatAsideToggle, NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-remembered-panel.example.html',
})
export class RememberedPanel {
  private readonly remembered = neatStoredSignal('neat-ui-showcase:remembered-panel', true, (v) =>
    typeof v === 'boolean' ? v : undefined,
  );
  protected readonly aside = neatAsideOpen(this.remembered, (open) => this.remembered.set(open));
}
