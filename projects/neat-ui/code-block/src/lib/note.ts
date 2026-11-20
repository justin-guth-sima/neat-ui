import { Directive, inject, input, TemplateRef } from '@angular/core';
import type { NeatBubbleSide } from '@sima/neat-ui/bubble';
import type { NeatCodeMark, NeatCodeStep } from './marks';

/** What a code block gives its note template: the step or the mark, and its index from 0. */
export interface NeatCodeNoteContext<T> {
  /** The step shown, or the mark the note is for, as the app gave it. */
  readonly $implicit: T;
  /** Its index in the block's `steps` or `marks`, from 0. */
  readonly index: number;
}

/**
 * The note a code block shows in a bubble (`NeatBubble`) beside its marks: the template is given
 * the step or the mark, as the app gave it, so it shows the app's own words for it.
 *
 * ```html
 * <neat-code-block [code]="source" language="python" [steps]="walk" [(step)]="at" stepControls>
 *   <ng-template [neatCodeNote]="walk" let-step>{{ step.note }}</ng-template>
 * </neat-code-block>
 * ```
 *
 * With `steps`, the bubble shows the step's note beside the step's marks (the whole code for a
 * step without marks) and moves with the step. With `marks`, each mark is a tab stop, and its note
 * shows while a mouse or a pen is over the mark or the bubble, while the mark has the keyboard's
 * focus, or after a tap on it; Escape and a press elsewhere put it away. The bubble describes the
 * mark the focus is on (`aria-describedby`).
 *
 * `neatCodeNote` takes the block's steps or marks only so that the template's `let-` variable has
 * their type (`step.note` above). The template shows whatever it renders, so a mark without a note
 * of its own should not be in a block whose marks have notes.
 */
@Directive({ selector: 'ng-template[neatCodeNote]' })
export class NeatCodeNote<T extends NeatCodeStep | NeatCodeMark = NeatCodeStep | NeatCodeMark> {
  /** The block's `steps` or `marks`, which give the template's variable its type. */
  readonly neatCodeNote = input<readonly T[]>();
  /** The side of the marks the bubble prefers, a `NeatBubbleSide`: `top` by default. */
  readonly neatCodeNoteSide = input<NeatBubbleSide>('top');

  /** @internal */
  readonly template = inject<TemplateRef<NeatCodeNoteContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T extends NeatCodeStep | NeatCodeMark>(
    _directive: NeatCodeNote<T>,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is NeatCodeNoteContext<T> {
    return true;
  }
}
