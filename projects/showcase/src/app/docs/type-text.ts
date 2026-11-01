import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DocsContext } from './docs-context';
import { PartRef } from './part-ref';

/** A run of the text, and the part it names when it is a documented name. */
interface Piece {
  readonly text: string;
  readonly part?: string;
}

const NAMES = /[A-Za-z_$][\w$]*/g;

/**
 * Type text as written (a member's type, a signature, a definition), each name the docs document
 * a link to it. It spells the text again exactly, so it can sit in a `pre`.
 */
@Component({
  selector: 'app-type-text',
  imports: [PartRef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (piece of pieces(); track $index) {
    @if (piece.part) {
      <app-part-ref [name]="piece.part" />
    } @else {
      <ng-container>{{ piece.text }}</ng-container>
    }
  }`,
})
export class TypeText {
  readonly text = input.required<string>();

  private readonly docs = inject(DocsContext);

  /** The documented names, and the text between them in as few runs as it takes. */
  protected readonly pieces = computed(() => {
    const text = this.text();
    const pieces: Piece[] = [];
    let from = 0;
    for (const match of text.matchAll(NAMES)) {
      if (!this.docs.target(match[0])) continue;
      if (match.index > from) pieces.push({ text: text.slice(from, match.index) });
      pieces.push({ text: match[0], part: match[0] });
      from = match.index + match[0].length;
    }
    if (from < text.length) pieces.push({ text: text.slice(from) });
    return pieces;
  });
}
