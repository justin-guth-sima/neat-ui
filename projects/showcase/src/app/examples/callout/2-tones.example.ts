import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';

/**
 * One callout per tone, with no heading: the icon, the start border and the fill change.
 *
 * @gallery
 */
@Component({
  selector: 'app-tones',
  imports: [NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-tones.example.html',
  styleUrl: './tones.example.css',
})
export class Tones {
  protected readonly notes = [
    { tone: 'neutral', text: 'Idle' },
    { tone: 'success', text: 'Live' },
    { tone: 'warning', text: 'Unreachable' },
    { tone: 'danger', text: 'Auth failed' },
    { tone: 'info', text: 'Connecting' },
    { tone: 'highlight', text: 'External' },
  ] as const;
}
