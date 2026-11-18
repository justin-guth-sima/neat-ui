import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type NeatTone } from '@sima/neat-ui';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';

/** A stream: its state's tone tints the row and colors its chip. */
interface Stream {
  readonly id: number;
  readonly name: string;
  readonly tone: NeatTone;
  readonly state: string;
}

/** What each tone says, as Streaming's slot states do. */
const STATES: Record<NeatTone, string> = {
  neutral: 'Idle',
  success: 'Live',
  warning: 'Unreachable',
  danger: 'Auth failed',
  info: 'Connecting',
  highlight: 'External',
};

const STREAMS: readonly Stream[] = (
  ['success', 'success', 'neutral', 'highlight', 'warning', 'danger', 'info', 'neutral'] as const
).map((tone, index) => ({
  id: index + 1,
  name: `src${index + 1}`,
  tone,
  state: STATES[tone],
}));

/**
 * Streams with each row tinted by its state, and the same tone on its chip. The fourth is
 * selected: hover another row and compare the two, the selected one keeping its bar. The neutral
 * rows have no tint.
 *
 * @gallery
 */
@Component({
  selector: 'app-toned',
  imports: [NeatColumn, NeatSelectList, NeatStatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './8-toned.example.html',
  styleUrl: './toned.example.css',
})
export class Toned {
  protected readonly streams = STREAMS;
  protected readonly selected = signal<Stream | null>(STREAMS[3]);
  protected readonly streamId = (stream: Stream) => stream.id;
  protected readonly streamTone = (stream: Stream) => stream.tone;
}
