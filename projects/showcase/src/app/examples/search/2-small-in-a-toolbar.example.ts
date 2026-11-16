import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatIcon, NeatSearch } from '@sima/neat-ui';

/**
 * The small field, 2rem high like the small buttons beside it, at the start of a row of tools. It
 * shows no status line: what it filters says what is left.
 */
@Component({
  selector: 'app-small-in-a-toolbar',
  imports: [NeatButton, NeatIcon, NeatSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tools">
      <neat-search
        size="small"
        label="Filter files"
        placeholder="Filter files…"
        [(value)]="query"
      />
      <button neatButton variant="outlined" size="small">
        <neat-icon name="upload" [size]="16" />
        Upload
      </button>
      <button neatButton variant="text" size="small" iconOnly aria-label="Refresh">
        <neat-icon name="refresh" [size]="16" />
      </button>
    </div>
  `,
  styleUrl: './small-in-a-toolbar.example.css',
})
export class SmallInAToolbar {
  protected readonly query = signal('');
}
