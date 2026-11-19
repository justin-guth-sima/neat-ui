import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatShortcut } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/** What a page does, and the keys that do it. */
interface Action {
  readonly label: string;
  readonly keys: readonly string[];
}

const ACTIONS: readonly Action[] = [
  { label: 'Search', keys: ['Mod', 'K'] },
  { label: 'Redo', keys: ['Mod', 'Shift', 'Z'] },
  { label: 'Move up', keys: ['ArrowUp'] },
  { label: 'Close', keys: ['Escape'] },
];

/**
 * A page's actions beside their keys. `Mod` shows ⌘ on a Mac and Ctrl elsewhere, and a Mac shows
 * its other modifiers as symbols too.
 */
@Component({
  selector: 'app-keys-of-an-app',
  imports: [NeatDetails, NeatShortcut],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-keys-of-an-app.example.html',
  styleUrl: './keys-of-an-app.example.css',
})
export class KeysOfAnApp {
  protected readonly actions = ACTIONS;
}
