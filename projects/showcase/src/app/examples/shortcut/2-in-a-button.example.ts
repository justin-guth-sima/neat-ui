import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatNote, NeatShortcut } from '@sima/neat-ui';

/**
 * A button that shows its shortcut, and the page's handler for it. The button's
 * `aria-keyshortcuts` names the keys to assistive technology, so the shortcut is `aria-hidden` and
 * the button's name stays "Run".
 *
 * Press Ctrl Enter (⌘ Enter on a Mac), or the button.
 */
@Component({
  selector: 'app-in-a-button',
  imports: [NeatButton, NeatNote, NeatShortcut],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './2-in-a-button.example.html',
})
export class InAButton {
  protected readonly runs = signal(0);

  /** Ctrl Enter or ⌘ Enter, as `Mod` says: the handler takes either modifier. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    if (event.altKey || event.shiftKey) return;
    event.preventDefault();
    this.run();
  }

  protected run(): void {
    this.runs.update((runs) => runs + 1);
  }
}
