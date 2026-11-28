import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import {
  NeatMessageBox,
  pictureFromFile,
  type NeatChatPicture,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from '@sima/neat-ui/chat';

/** One message box in a fixed state, for the spike's screenshots. */
interface Cell {
  readonly id: string;
  readonly text?: string;
  readonly pictures?: boolean;
  readonly disabled?: boolean;
  readonly activity?: NeatMessageBoxActivity;
  readonly glow?: NeatMessageBoxGlow;
  readonly speaking?: boolean;
  readonly talk?: boolean;
  readonly camera?: boolean;
  readonly recording?: boolean;
}

const GLOWS: readonly NeatMessageBoxGlow[] = ['comet', 'steady-comet', 'ring', 'aurora', 'sheen'];
const LONG = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of a long question`).join('\n');

const CELLS: readonly Cell[] = [
  { id: 'empty' },
  { id: 'focused' },
  { id: 'text-3-lines', text: 'What could I cook\nwith what is on\nthis shelf?' },
  { id: 'text-overflow', text: LONG },
  { id: 'pictures', text: 'What could I cook with this?', pictures: true },
  { id: 'disabled', text: 'A draft while the box is off', disabled: true },
  { id: 'disabled-empty', disabled: true },
  { id: 'dragging' },
  ...GLOWS.flatMap((glow): Cell[] => [
    { id: `waiting-${glow}`, glow, activity: 'waiting' },
    { id: `streaming-${glow}`, glow, activity: 'streaming' },
  ]),
  { id: 'speaking-streaming', activity: 'streaming', speaking: true, glow: 'none' },
  { id: 'talk-camera', talk: true, camera: true },
  { id: 'talk-recording', talk: true, camera: true, recording: true },
];

/** A spike-only page: every state of the message box at once. Not part of the docs. */
@Component({
  selector: 'app-msgbox-spike-page',
  imports: [NeatPage, NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="cells">
        @for (cell of cells; track cell.id) {
          <div class="cell" [attr.data-cell]="cell.id">
            <neat-message-box
              [text]="cell.text ?? ''"
              [pictures]="cell.pictures ? pictures() : []"
              [disabled]="cell.disabled ?? false"
              [activity]="cell.activity ?? 'idle'"
              [glow]="cell.glow ?? 'comet'"
              [speaking]="cell.speaking ?? false"
              [talk]="cell.talk ?? false"
              [camera]="cell.camera ?? false"
              [recording]="cell.recording ?? false"
            />
          </div>
        }
      </div>
    </neat-page>
  `,
  styles: `
    .cells {
      display: flex;
      flex-direction: column;
    }
    .cell {
      width: 30rem;
      padding: 48px;
    }
  `,
})
export class MsgboxSpikePage {
  protected readonly cells = CELLS;
  protected readonly pictures = signal<readonly NeatChatPicture[]>([]);

  constructor() {
    void (async () => {
      const answer = await fetch('examples/shelf.webp');
      const blob = await answer.blob();
      const file = (name: string) => new File([blob], name, { type: 'image/webp' });
      this.pictures.set([pictureFromFile(file('shelf.webp')), pictureFromFile(file('shelf-2.webp'))]);
    })();
  }
}
