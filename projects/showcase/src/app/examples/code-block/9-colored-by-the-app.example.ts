import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

/** A stretch of code and the kind of text it is, as a highlighter gives them. */
interface Run {
  readonly kind: 'keyword' | 'string' | 'text';
  readonly text: string;
}

const RUNS: readonly Run[] = [
  { kind: 'keyword', text: 'const' },
  { kind: 'text', text: ' source = ' },
  { kind: 'string', text: "'rtsp://neat.local:8554/src3'" },
  { kind: 'text', text: ';' },
];

/**
 * Code the app colored itself, as spans inside the block: runs from a highlighter of its own, as
 * the showcase's snippets are colored at build time. They are shown in place of `code`, which
 * spells the same text and stays what Copy copies. The spans take the theme's code colors, as
 * `--neat-code-keyword` here. For code in a language the kit knows, `language` is simpler.
 */
@Component({
  selector: 'app-colored-by-the-app',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './9-colored-by-the-app.example.html',
  styleUrl: './colored-by-the-app.example.css',
})
export class ColoredByTheApp {
  protected readonly runs = RUNS;
  protected readonly code = RUNS.map((run) => run.text).join('');
}
