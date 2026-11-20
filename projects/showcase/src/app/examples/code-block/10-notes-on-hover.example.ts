import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, type NeatCodeMark, NeatCodeNote } from '@sima/neat-ui/code-block';
import { SESSION } from './session';

/** A mark with the note its bubble shows. */
type Noted = NeatCodeMark & { readonly note: string };

/**
 * The same session with a note on each mark, shown in a bubble while the mark is hovered: a
 * `neatCodeNote` template inside the block, given the mark as the app wrote it. Each mark is then
 * a tab stop that shows its note on keyboard focus, and a tap shows it on a touch screen; Escape
 * or a press elsewhere puts it away.
 *
 * Hover a mark, or press Tab to reach one.
 *
 * @play hover mark[data-mark="2"]
 * @play wait 300
 */
@Component({
  selector: 'app-notes-on-hover',
  imports: [NeatCodeBlock, NeatCodeNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './10-notes-on-hover.example.html',
})
export class NotesOnHover {
  protected readonly session = SESSION;
  protected readonly marks: readonly Noted[] = [
    { line: 1, from: 44, to: 47, note: 'The stream comes over RTSP, from Insight on neat.local.' },
    { line: 1, text: '--frames 4', note: 'The program stops after four frames.' },
    {
      line: 5,
      note: 'The fourth frame did not come in time: the stream stopped, or the network dropped it.',
    },
  ];
}
