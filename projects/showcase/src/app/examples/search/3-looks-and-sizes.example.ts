import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatSearch, type NeatSearchVariant } from '@sima/neat-ui';

/**
 * The four looks at the medium size, then the raised look at the large size, as a page whose main
 * job is searching puts it. `'filled'` is the default; `'outlined'` matches a form's text fields.
 */
@Component({
  selector: 'app-looks-and-sizes',
  imports: [NeatSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="looks">
      @for (look of looks; track look) {
        <div class="look">
          <span class="showcase-code showcase-muted">{{ look }}</span>
          <neat-search
            [variant]="look"
            [label]="'Filter streams, ' + look"
            placeholder="Filter streams"
          />
        </div>
      }
    </div>
    <div class="look">
      <span class="showcase-code showcase-muted">raised, large</span>
      <neat-search
        variant="raised"
        size="large"
        label="Search the docs"
        placeholder="Search the docs"
      />
    </div>
  `,
  styleUrl: './looks-and-sizes.example.css',
})
export class LooksAndSizes {
  protected readonly looks: readonly NeatSearchVariant[] = [
    'filled',
    'outlined',
    'underlined',
    'raised',
  ];
}
