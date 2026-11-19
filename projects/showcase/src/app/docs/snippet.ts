import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NeatCode, NeatNote } from '@sima/neat-ui';
import { NeatCodeBlock, NeatCopyButton } from '@sima/neat-ui/code-block';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';
import type { DocsExampleFile, DocsToken } from './model';
import { Runs } from './runs';

/**
 * An example's code, closed until asked for: the live example comes first, and a closed snippet
 * renders none of its runs. Open, an example of several files shows them as tabs labeled "Files",
 * in the order given, which choosing one does not change; an example of one file shows its code
 * directly. The trigger's row copies the file shown, and below the code is a line naming where
 * the `showcase-*` classes it uses are defined, since no snippet carries them.
 */
@Component({
  selector: 'app-snippet',
  imports: [
    NeatCode,
    NeatCodeBlock,
    NeatCollapsible,
    NeatCopyButton,
    NeatNote,
    NeatTab,
    NeatTabs,
    Runs,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-collapsible label="Code" [summary]="summary()" [(open)]="open">
      <!-- Two blocks of one element each: each is projected by its element's selector. -->
      @if (open()) {
        <div class="files" neatCollapsibleEnd>
          <neat-copy-button [text]="text()" [what]="file().name" />
        </div>
      }
      @if (open()) {
        @if (files().length > 1) {
          <neat-tabs label="Files" [(value)]="chosen">
            @for (f of files(); track f.name) {
              <neat-tab [label]="f.name" [value]="f.name">
                <ng-template>
                  <neat-code-block [code]="textOf(f.code)" overflow="scroll">
                    <app-runs [runs]="f.code" />
                  </neat-code-block>
                </ng-template>
              </neat-tab>
            }
          </neat-tabs>
        } @else {
          <neat-code-block [code]="text()" overflow="scroll">
            <app-runs [runs]="file().code" />
          </neat-code-block>
        }
        @if (usesShowcaseClasses()) {
          <p neatNote class="classes">
            <code neatCode>showcase-*</code> classes are the showcase's own layout helpers, in
            <code neatCode>projects/showcase/src/styles.css</code>.
          </p>
        }
      }
    </neat-collapsible>
  `,
  styleUrl: './snippet.css',
})
export class Snippet {
  /** The example's file first, then its template, the files it imports and its stylesheets. */
  readonly files = input.required<readonly DocsExampleFile[]>();

  protected readonly open = signal(false);
  protected readonly summary = computed(() =>
    this.files()
      .map((file) => file.name)
      .join(', '),
  );
  /** The example's own file until the reader chooses another. */
  protected readonly chosen = linkedSignal(() => this.files()[0].name);
  protected readonly file = computed(
    () => this.files().find((file) => file.name === this.chosen()) ?? this.files()[0],
  );
  /** The shown file as written. */
  protected readonly text = computed(() => this.textOf(this.file().code));
  /** A file as written: its runs spell it again. */
  protected textOf(runs: readonly DocsToken[]): string {
    return runs.map(([, run]) => run).join('');
  }

  /** The shown file uses a class of the showcase's stylesheet, which a copy would not bring. */
  protected readonly usesShowcaseClasses = computed(() => /\bshowcase-[a-z]/.test(this.text()));
}
