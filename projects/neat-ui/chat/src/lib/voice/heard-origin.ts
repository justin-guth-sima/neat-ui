import { inject, Injectable } from '@angular/core';
import { CHAT_CLOCK } from '../chat-clock';

/** How long a noted origin waits for its heard question (ms). */
export const HEARD_ORIGIN_MS = 15_000;

/**
 * Where the next heard question comes from: the message box notes its text area as an
 * `in-message-box` recording ends, and the transcript takes it when the heard question arrives,
 * so the question's text flies out of the box. Kept for 15 s, given once. Internal.
 */
@Injectable({ providedIn: 'root' })
export class HeardOrigin {
  private readonly clock = inject(CHAT_CLOCK);
  private element: HTMLElement | null = null;
  private notedAt = 0;

  /** The next heard question comes from this element, as its recording ended now. */
  note(element: HTMLElement): void {
    this.element = element;
    this.notedAt = this.clock.now();
  }

  /** That element, once, within 15 s of the note; else null. */
  take(): HTMLElement | null {
    const element = this.element;
    this.element = null;
    if (!element || this.clock.now() - this.notedAt > HEARD_ORIGIN_MS) return null;
    return element;
  }
}
