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
  templateUrl: './3-looks-and-sizes.example.html',
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
