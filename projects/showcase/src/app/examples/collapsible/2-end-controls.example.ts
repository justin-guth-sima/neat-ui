import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatNote } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';

/**
 * A log with two controls at the end of its row, outside its button. The summary counts the lines.
 *
 * Try Add line, which works open or closed. Clear is there only while the log is open.
 *
 * @animated
 * @play click [data-slot=collapsible-trigger]
 * @play click [neatCollapsibleEnd]
 * @play click [neatCollapsibleEnd]
 * @play wait 600
 */
@Component({
  selector: 'app-end-controls',
  imports: [NeatButton, NeatCollapsible, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-end-controls.example.html',
  styleUrl: './panel.css',
})
export class EndControls {
  protected readonly open = signal(false);
  protected readonly lines = signal(['Pipeline started', 'Frame 1 decoded', 'Frame 2 decoded']);

  protected add(): void {
    this.lines.update((lines) => [...lines, `Frame ${lines.length} decoded`]);
  }
}
