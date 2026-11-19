import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  private readonly route = inject(ActivatedRoute);
  protected readonly target = computed(() => this.docs.target(this.name()));

  /**
   * The page reveals a part when the URL's fragment becomes its anchor, so a click, and back and
   * forward, all work through the router. The one click it cannot see is on the fragment the URL
   * already has (the same section again, after scrolling away): the router skips a navigation to
   * the URL it is at, so the fragment does not change. `neat-page` scrolls to it again, and the
   * link opens the panel and focuses the heading itself.
   */
  protected follow(): void {
    const target = this.target();
    if (target?.here && this.route.snapshot.fragment === target.fragment) {
      this.docs.reveal(this.name());
    }
  }
}
