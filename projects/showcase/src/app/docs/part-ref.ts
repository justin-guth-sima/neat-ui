import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocsContext } from './docs-context';

/**
 * A part's name as a link to its section: in this page's API panel, which it opens, or on the
 * topic that documents it. A name no topic documents keeps its place as plain text (a link
 * without a target, which neither looks nor acts like one).
 */
@Component({
  selector: 'app-part-ref',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a
    [routerLink]="target()?.commands ?? null"
    [fragment]="target()?.fragment"
    (click)="follow()"
    >{{ label() || name() }}</a
  >`,
  styleUrl: './part-ref.css',
})
export class PartRef {
  /** The part's export name. */
  readonly name = input.required<string>();
  /** The text shown, when it is not the name (`NeatDiagramSet.levels`). */
  readonly label = input('');

  private readonly docs = inject(DocsContext);
  protected readonly target = computed(() => this.docs.target(this.name()));

  /**
   * Also on a click that changes nothing in the URL (the same section again, after scrolling
   * away), which the page's fragment alone would miss.
   */
  protected follow(): void {
    if (this.target()?.here) this.docs.reveal(this.name());
  }
}
