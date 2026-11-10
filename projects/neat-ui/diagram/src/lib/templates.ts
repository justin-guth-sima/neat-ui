import { Directive, inject, TemplateRef } from '@angular/core';
import type { NeatDiagramEdge, NeatDiagramNode, NeatDiagramNote } from './model';

/*
 * The app's content in a diagram: one template for every block's body, one for every note and one
 * for the tip of the edge under the pointer, each given the part it renders for, so the app
 * decides per part (by id, by its `data`) what it shows. One template per kind rather than one per
 * id keeps the diagram's input plain data that an app can recompute on every poll.
 */

/** What a block's template is given: the block. */
export interface NeatDiagramBlockContext {
  readonly $implicit: NeatDiagramNode;
}

/** What the edge tip's template is given: the edge. */
export interface NeatDiagramEdgeTipContext {
  readonly $implicit: NeatDiagramEdge;
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
 * The card keeps the node's size, so the app sizes the node's `h` (and `w`) for the body. A block
 * it renders nothing for keeps its card as it is. A bracket renders it too, after its label and
 * detail (the stage's live time over a row of blocks, say): `node.role` tells the two apart, and
 * a template that matches by id never meets the other.
 */
@Directive({ selector: 'ng-template[neatDiagramBlock]' })
export class NeatDiagramBlockTemplate {
  /**
   * @internal The template the diagram renders; apps never read it.
   */
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
 * A note it renders nothing for is not drawn, nor its leader; without the template no note is. A
 * note anchored by `anchor` alone belongs to no edge, so it dims whenever anything is in focus.
 */
@Directive({ selector: 'ng-template[neatDiagramNote]' })
export class NeatDiagramNoteTemplate {
  /**
   * @internal The template the diagram renders; apps never read it.
   */
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

/**
 * The tip of the edge under the pointer, by the pointer, in the popover's colors and kept inside
 * the diagram's box:
 *
 * ```html
 * <ng-template neatDiagramEdgeTip let-edge>
 *   <b>{{ edge.label }}</b> {{ rate(edge.id) }} msg/s
 * </ng-template>
 * ```
 *
 * It follows a mouse or a pen, never touch (which has no hover), and is hidden from assistive
 * technology: the diagram's hidden list says each edge in words, so a tip must not hold anything
 * a reader needs that the list or a note does not say. An edge it renders nothing for shows no
 * tip.
 */
@Directive({ selector: 'ng-template[neatDiagramEdgeTip]' })
export class NeatDiagramEdgeTipTemplate {
  /**
   * @internal The template the diagram renders; apps never read it.
   */
  readonly template = inject<TemplateRef<NeatDiagramEdgeTipContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: NeatDiagramEdgeTipTemplate,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is NeatDiagramEdgeTipContext {
    return true;
  }
}
