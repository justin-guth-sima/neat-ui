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
  templateUrl: './2-small-in-a-toolbar.example.html',
  styleUrl: './small-in-a-toolbar.example.css',
})
export class SmallInAToolbar {
  protected readonly query = signal('');
}
