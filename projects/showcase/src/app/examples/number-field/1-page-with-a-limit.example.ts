import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatNumberField } from '@sima/neat-ui/number-field';

const PAGE_COUNT = 9;

/**
 * A page field that accepts 1 to 9, with "of 9" after the input. Type 12 or a word and press
 * Enter: the shown number comes back and the count stays. Commit 5, or the shown number again,
 * and the count goes up. The button calls `focus()`.
 */
@Component({
  selector: 'app-page-with-a-limit',
  imports: [NeatButton, NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <neat-number-field
        #pageField
        label="Page"
        [value]="page()"
        [accept]="acceptPage"
        (commit)="commit($event)"
      >
        <span neatNumberFieldSuffix>of {{ pageCount }}</span>
      </neat-number-field>
      <button neatButton type="button" variant="outlined" (click)="pageField.focus()">
        Focus the page field
      </button>
    </div>
    <p class="showcase-code showcase-muted">Page {{ page() }}, commits so far {{ commits() }}</p>
  `,
  styleUrl: './stack.css',
})
export class PageWithALimit {
  protected readonly pageCount = PAGE_COUNT;
  protected readonly page = signal(3);
  protected readonly commits = signal(0);
  protected readonly acceptPage = (n: number) => n >= 1 && n <= PAGE_COUNT;

  protected commit(page: number): void {
    this.page.set(page);
    this.commits.update((count) => count + 1);
  }
}
