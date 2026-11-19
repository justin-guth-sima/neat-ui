import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NeatButton, NeatIcon } from '@sima/neat-ui';

/** How long the button says what happened before it offers to copy again. */
const SETTLE_MS = 2500;

type CopyState = 'idle' | 'copied' | 'failed';

const CAPTION: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Could not copy',
};

const ANNOUNCEMENT: Record<CopyState, string> = {
  idle: '',
  copied: 'Copied to the clipboard.',
  failed: 'Could not copy: the browser refused the clipboard.',
};

/**
 * A small Copy button that puts `text` on the clipboard and says whether it did.
 *
 * ```html
 * <code neatCode>{{ url }}</code>
 * <neat-copy-button [text]="url" what="stream URL" />
 * ```
 *
 * `NeatCodeBlock` shows one beside its code. Use this part on its own for text shown some other
 * way: a URL in running text, or code whose Copy button sits outside it (above a set of tabs).
 *
 * After a click the button says "Copied", with a check, or "Could not copy". It says the same in a
 * polite live region, and offers to copy again after 2.5 s.
 *
 * Its accessible name is "Copy" and `what`: "Copy stream URL", so a page with several buttons
 * does not read as a list of "Copy". The name starts with the visible caption, so a voice user can
 * say what they see.
 *
 * It needs a secure context. A browser gives the clipboard to pages served over https and from
 * localhost only, so on a page served over plain http the button says it could not copy. It has
 * no fallback.
 */
@Component({
  selector: 'neat-copy-button',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      neatButton
      type="button"
      variant="text"
      size="small"
      [attr.aria-label]="name()"
      (click)="copy()"
    >
      <neat-icon [name]="icon()" [size]="16" />
      {{ caption() }}
    </button>
    <span class="sr-only" role="status">{{ announcement() }}</span>
  `,
  styleUrl: './copy-button.css',
})
export class NeatCopyButton {
  /** The text the button copies. */
  readonly text = input.required<string>();
  /** What the text is, for the button's name: `install command` names it "Copy install command". */
  readonly what = input.required<string>();

  private readonly state = signal<CopyState>('idle');
  protected readonly caption = computed(() => CAPTION[this.state()]);
  protected readonly icon = computed(() => (this.state() === 'copied' ? 'check' : 'copy'));
  protected readonly name = computed(() =>
    this.state() === 'idle' ? `Copy ${this.what()}` : this.caption(),
  );
  protected readonly announcement = computed(() => ANNOUNCEMENT[this.state()]);

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(): Promise<void> {
    let copied = true;
    try {
      // Absent outside a secure context, which the catch takes as a refusal.
      await navigator.clipboard.writeText(this.text());
    } catch {
      copied = false;
    }
    this.state.set(copied ? 'copied' : 'failed');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state.set('idle'), SETTLE_MS);
  }
}
