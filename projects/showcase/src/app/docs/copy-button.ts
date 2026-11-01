import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';

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
 * A small text button that copies `text` and says, on itself and in a polite live region, whether
 * it did. A browser gives the clipboard to a secure context only (https, localhost), so a page
 * served over plain http says it could not copy.
 */
@Component({
  selector: 'app-copy-button',
  imports: [NeatButton],
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
      {{ caption() }}
    </button>
    <span class="announcement" role="status">{{ announcement() }}</span>
  `,
  styleUrl: './copy-button.css',
})
export class CopyButton {
  readonly text = input.required<string>();
  /** What the text is, for the button's name: "Copy import line", not one of many "Copy". */
  readonly what = input.required<string>();

  private readonly state = signal<CopyState>('idle');
  protected readonly caption = computed(() => CAPTION[this.state()]);
  // The visible caption starts the name, so a voice user can say what they see.
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
