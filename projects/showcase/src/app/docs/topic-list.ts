import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  isActive,
  type IsActiveMatchOptions,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatInput } from '@sima/neat-ui/input';
import type { DocsCategory, DocsTopicList } from './docs-context';

let nextListId = 0;

/** A topic is open on its own path, whatever the fragment (`#api-NeatButton`) or the query. */
const OPEN: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

/**
 * A group's topics under their category headings, with a filter over them, as its pages show
 * them in place of tabs (Components: 47 topics, too many for a row of tabs). The filter keeps the
 * topics whose label, or whose heading, holds what was typed, and hides a heading with none left.
 * The open topic is `aria-current="page"`.
 *
 * Beside the topic (`collapsible` false) it is a column that scrolls on its own, so it stays in
 * view while the topic scrolls; the page around it puts it before its `neat-page`. Each topic is
 * a page of its own, so the list is drawn anew on each, and it scrolls its own box to the open
 * topic, never with `scrollIntoView`, which would scroll the page around it too. On a narrow
 * screen (`collapsible`) it sits above the topic, closed, in a section named after the group with
 * the open topic as its summary, and scrolls with the page.
 */
@Component({
  selector: 'app-topic-list',
  imports: [NeatCollapsible, NeatInput, NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-layout]': "collapsible() ? 'collapsible' : 'column'" },
  template: `
    @if (collapsible()) {
      <neat-collapsible [label]="list().label" [summary]="current()">
        <ng-container *ngTemplateOutlet="topics" />
      </neat-collapsible>
    } @else {
      <ng-container *ngTemplateOutlet="topics" />
    }
    <ng-template #topics>
      <nav [attr.aria-label]="list().label + ' topics'">
        <div class="filter">
          <input
            neatInput
            type="search"
            size="small"
            [attr.aria-label]="filterLabel()"
            [placeholder]="filterLabel()"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
          />
        </div>
        @for (category of shown(); track category.label; let i = $index) {
          <h2 [id]="id + '-' + i">{{ category.label }}</h2>
          <ul [attr.aria-labelledby]="id + '-' + i">
            @for (topic of category.topics; track topic.path) {
              <li>
                <a
                  [routerLink]="topic.path"
                  routerLinkActive
                  ariaCurrentWhenActive="page"
                  [routerLinkActiveOptions]="open"
                  >{{ topic.label }}</a
                >
              </li>
            }
          </ul>
        } @empty {
          <p>No topic matches “{{ filter().trim() }}”.</p>
        }
      </nav>
    </ng-template>
  `,
  styleUrl: './topic-list.css',
})
export class TopicList {
  readonly list = input.required<DocsTopicList>();
  /** Collapsed into a section above the topic, for a narrow screen, instead of a column. */
  readonly collapsible = input(false, { transform: booleanAttribute });
  /** The open topic's label: the collapsed section's summary. */
  readonly current = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly router = inject(Router);
  protected readonly id = `topic-list-${++nextListId}`;
  protected readonly open = OPEN;
  protected readonly filter = signal('');
  protected readonly filterLabel = computed(() => `Filter ${this.list().label.toLowerCase()}`);

  /** The categories with the topics the filter keeps; all of a category whose heading matches. */
  protected readonly shown = computed((): DocsCategory[] => {
    const wanted = this.filter().trim().toLowerCase();
    const holds = (label: string) => label.toLowerCase().includes(wanted);
    return this.list().categories.flatMap((category) => {
      const topics = holds(category.label)
        ? category.topics
        : category.topics.filter((topic) => holds(topic.label));
      return topics.length ? [{ label: category.label, topics }] : [];
    });
  });

  constructor() {
    afterNextRender(() => this.revealCurrent());
  }

  /**
   * Scrolls the list's own box so the open topic shows, centred, when it does not already. The
   * open topic is the router's, not `aria-current`, which `RouterLinkActive` sets only once the
   * app's first navigation has ended. The host is the links' offset parent (`position: relative`
   * in its stylesheet). Collapsed, the host does not scroll, and its `scrollTop` stays 0.
   */
  private revealCurrent(): void {
    const path = this.list()
      .categories.flatMap((category) => category.topics)
      .find((topic) => isActive(topic.path, this.router, OPEN)())?.path;
    const link = path && this.host.querySelector<HTMLElement>(`a[href="${path}"]`);
    if (!link) return;
    const box = this.host;
    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) return;
    box.scrollTop = top - (box.clientHeight - link.offsetHeight) / 2;
  }
}
