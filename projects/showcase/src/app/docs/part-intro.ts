import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { CopyButton } from './copy-button';
import { introCut, KIND_LABEL, usageLine } from './display';
import { DocText } from './doc-text';
import type { DocsDeclaredPart } from './model';

/**
 * A part the topic's examples show, as the body introduces it above them: its name, kind and
 * usage, the line that imports it, and its description up to the second paragraph, the rest on
 * request. Its members are the panel's.
 */
@Component({
  selector: 'app-part-intro',
  imports: [CopyButton, DocText, NeatCallout, NeatInlineButton, NeatStatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-labelledby]="ids().heading">
      <div class="head">
        <h2 [id]="ids().heading">
          @if (part().deprecated) {
            <s>{{ part().name }}</s>
          } @else {
            {{ part().name }}
          }
        </h2>
        <neat-status-chip>{{ kind() }}</neat-status-chip>
        @if (usage(); as usage) {
          <code class="usage">{{ usage }}</code>
        }
      </div>
      <div class="import">
        <code>{{ importLine() }}</code>
        <app-copy-button [text]="importLine()" what="import line" />
      </div>
      @if (part().deprecated; as deprecated) {
        <neat-callout tone="warning" heading="Deprecated">
          <app-doc-text [blocks]="deprecated" />
        </neat-callout>
      }
      <app-doc-text [id]="ids().doc" [blocks]="shown()" />
      @if (cut() < part().doc.length) {
        <button
          neatInlineButton
          type="button"
          [attr.aria-expanded]="whole()"
          [attr.aria-controls]="ids().doc"
          (click)="whole.set(!whole())"
        >
          {{ whole() ? 'Show less' : 'Show the whole description' }}
        </button>
      }
    </section>
  `,
  styleUrl: './part-intro.css',
})
export class PartIntro {
  readonly part = input.required<DocsDeclaredPart>();
  /** The import path of the entry that owns it: what new code imports it from. */
  readonly import = input.required<string>();

  protected readonly whole = signal(false);

  protected readonly ids = computed(() => ({
    heading: `intro-${this.part().name}`,
    doc: `intro-${this.part().name}-doc`,
  }));
  protected readonly kind = computed(() => KIND_LABEL[this.part().kind]);
  protected readonly usage = computed(() => usageLine(this.part()));
  protected readonly importLine = computed(
    () => `import { ${this.part().name} } from '${this.import()}';`,
  );
  protected readonly cut = computed(() => introCut(this.part().doc));
  protected readonly shown = computed(() =>
    this.whole() ? this.part().doc : this.part().doc.slice(0, this.cut()),
  );
}
