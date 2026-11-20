import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, type NeatCodeMark } from '@sima/neat-ui/code-block';
import { SESSION } from './session';

/**
 * Marks on code without a language, a terminal session: the stream's protocol, the frames asked
 * for, and the line where the stream stopped. Marked text is in the text color, and the rest dims
 * to the muted one.
 *
 * Text that comes more than once on its line takes columns, counted from 1: "rtsp" is in the
 * program's name too, so `{ line: 1, from: 44, to: 47 }` marks the URL's.
 */
@Component({
  selector: 'app-marks-on-plain-code',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './9-marks-on-plain-code.example.html',
})
export class MarksOnPlainCode {
  protected readonly session = SESSION;
  protected readonly marks: readonly NeatCodeMark[] = [
    { line: 1, from: 44, to: 47 },
    { line: 1, text: '--frames 4' },
    { line: 5 },
  ];
}
