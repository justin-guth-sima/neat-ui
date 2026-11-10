import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatNote } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';

/**
 * A log with two controls at the end of its row, outside its button. The summary counts the lines.
 *
 * Try Add line, which works open or closed. Clear is there only while the log is open.
 */
@Component({
  selector: 'app-end-controls',
  imports: [NeatButton, NeatCollapsible, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <neat-collapsible label="Log" [summary]="lines().length + ' lines'" [(open)]="open">
        <button
          neatCollapsibleEnd
          neatButton
          type="button"
          variant="text"
          size="small"
          (click)="add()"
        >
          Add line
        </button>
        @if (open()) {
          <button
            neatCollapsibleEnd
            neatButton
            type="button"
            variant="text"
            size="small"
            (click)="lines.set([])"
          >
            Clear
          </button>
        }
        @for (line of lines(); track $index) {
          <p neatNote>{{ line }}</p>
        } @empty {
          <p neatNote>No lines.</p>
        }
      </neat-collapsible>
    </div>
  `,
  styleUrl: './panel.css',
})
export class EndControls {
  protected readonly open = signal(false);
  protected readonly lines = signal(['Pipeline started', 'Frame 1 decoded', 'Frame 2 decoded']);

  protected add(): void {
    this.lines.update((lines) => [...lines, `Frame ${lines.length} decoded`]);
  }
}
