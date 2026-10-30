import { Directive, inject, TemplateRef } from '@angular/core';
import type { NeatDiagramNode, NeatDiagramNote } from './model';

/*
 * The app's content in a diagram: one template for every block's body and one for every note,
 * each given the part it renders for, so the app decides per part (by id, by its `data`) what it
 * shows. One template per kind rather than one per id keeps the diagram's input plain data that
 * an app can recompute on every poll.
 */

/** What a block's template is given: the block. */
export interface NeatDiagramBlockContext {
  readonly $implicit: NeatDiagramNode;
}

/** What a note's template is given: the note. */
export interface NeatDiagramNoteContext {
  readonly $implicit: NeatDiagramNote;
}

/**
 * The body of the diagram's blocks, below each block's label (the demo's live figures):
 *
 * ```html
 * <ng-template neatDiagramBlock let-node>
 *   @if (node.id === 'decode') { <span>{{ fps() }} fps</span> }
 * </ng-template>
 * ```
 *
 * A block it renders nothing for keeps its card as it is.
 */
@Directive({ selector: 'ng-template[neatDiagramBlock]' })
export class NeatDiagramBlockTemplate {
  readonly template = inject<TemplateRef<NeatDiagramBlockContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: NeatDiagramBlockTemplate,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is NeatDiagramBlockContext {
    return true;
  }
}

/**
 * The content of the diagram's notes, in a box joined to its anchor by a dotted leader:
 *
 * ```html
 * <ng-template neatDiagramNote let-note>
 *   @if (note.id === 'rate') { <b>Camera → Decode</b> {{ rate() }} msg/s }
 * </ng-template>
 * ```
 *
 * A note it renders nothing for is not drawn, nor its leader; without the template no note is.
 */
@Directive({ selector: 'ng-template[neatDiagramNote]' })
export class NeatDiagramNoteTemplate {
  readonly template = inject<TemplateRef<NeatDiagramNoteContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: NeatDiagramNoteTemplate,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is NeatDiagramNoteContext {
    return true;
  }
}
