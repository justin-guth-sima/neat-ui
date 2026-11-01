import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatSegmented } from '@sima/neat-ui/segmented';
import { CopyButton } from './copy-button';
import type { DocsExampleFile, DocsToken } from './model';

/**
 * Source as the generator's runs, each coloured by its kind; they spell the file again, so they
 * can sit in a pre. Every text is its own node, so the template adds no space between runs.
 */
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (run of runs(); track $index) {
      @if (run[0] === 'text') {
        <ng-container>{{ run[1] }}</ng-container>
      } @else {
        <span [class]="run[0]">{{ run[1] }}</span>
      }
    }
  `,
  styleUrl: './runs.css',
})
export class Runs {
  readonly runs = input.required<readonly DocsToken[]>();
}

/**
 * An example's code, closed until asked for: the live example comes first, and a closed snippet
 * renders none of its runs. One file shows at a time, coloured by the generator's runs: the
 * example's own, or a file it imports, chosen in the bar beside the copy button.
 */
@Component({
  selector: 'app-snippet',
  imports: [CopyButton, NeatCollapsible, NeatSegmented, Runs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Nothing but the code inside the pre, whose whitespace is shown.
  template: `
    <neat-collapsible label="Code" [summary]="summary()" [(open)]="open">
      @if (open()) {
        <div class="bar">
          @if (choices().length > 1) {
            <neat-segmented label="File" [options]="choices()" [(value)]="chosen" />
          } @else {
            <code class="name">{{ file().name }}</code>
          }
          <app-copy-button [text]="text()" [what]="file().name" />
        </div>
        <pre><code><app-runs [runs]="file().code" /></code></pre>
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
  protected readonly choices = computed(() =>
    this.files().map((file) => ({ value: file.name, label: file.name })),
  );
  /** The example's own file until the reader chooses another. */
  protected readonly chosen = linkedSignal(() => this.files()[0].name);
  protected readonly file = computed(
    () => this.files().find((file) => file.name === this.chosen()) ?? this.files()[0],
  );
  /** The file as written: the runs spell it again. */
  protected readonly text = computed(() =>
    this.file()
      .code.map(([, run]) => run)
      .join(''),
  );
}
