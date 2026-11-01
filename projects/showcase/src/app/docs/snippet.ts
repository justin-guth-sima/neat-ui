import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NeatButton, NeatCode } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { CodeBox } from './code-box';
import { CopyButton } from './copy-button';
import type { DocsExampleFile } from './model';

/**
 * An example's code, closed until asked for: the live example comes first, and a closed snippet
 * renders none of its runs. Open, the trigger's row names the file shown, offers the example's
 * other files as small buttons and copies the one shown; below it is that one file.
 */
@Component({
  selector: 'app-snippet',
  imports: [CodeBox, CopyButton, NeatButton, NeatCode, NeatCollapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-collapsible label="Code" [summary]="summary()" [(open)]="open">
      <!-- Two blocks of one element each: each is projected by its element's selector. -->
      @if (open()) {
        <div class="files" neatCollapsibleEnd>
          <code neatCode class="showcase-muted">{{ file().name }}</code>
          <!-- By place, so a pressed button stays focused while its file and label swap. -->
          @for (other of others(); track $index) {
            <button
              neatButton
              type="button"
              variant="text"
              size="small"
              [attr.aria-label]="'Show ' + other.name"
              (click)="chosen.set(other.name)"
            >
              {{ other.name }}
            </button>
          }
          <app-copy-button [text]="text()" [what]="file().name" />
        </div>
      }
      @if (open()) {
        <app-code-box [runs]="file().code" overflow="scroll" />
      }
    </neat-collapsible>
  `,
  styleUrl: './snippet.css',
})
export class Snippet {
  /** The example's file first, then the files it imports. */
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
  protected readonly others = computed(() => this.files().filter((file) => file !== this.file()));
  /** The file as written: the runs spell it again. */
  protected readonly text = computed(() =>
    this.file()
      .code.map(([, run]) => run)
      .join(''),
  );
}
