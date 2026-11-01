import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DocText } from './doc-text';
import type { DocsExample } from './model';
import { PartRef } from './part-ref';
import { Snippet } from './snippet';

/**
 * One example of a topic: its title and caption, the parts it shows, the example itself, live,
 * and its code, which is the file that renders above it.
 */
@Component({
  selector: 'app-example-card',
  imports: [DocText, NgComponentOutlet, PartRef, Snippet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [attr.aria-labelledby]="headingId()">
      <h3 [id]="headingId()">{{ example().title }}</h3>
      <app-doc-text [blocks]="example().caption" />
      @if (shows().length) {
        <p class="shows">
          Shows
          @for (name of shows(); track name) {
            <code><app-part-ref [name]="name" /></code>
          }
        </p>
      }
      <div class="live">
        <ng-container *ngComponentOutlet="example().component" />
      </div>
      <app-snippet [files]="example().files" />
    </article>
  `,
  styleUrl: './example-card.css',
})
export class ExampleCard {
  readonly example = input.required<DocsExample>();

  /** Also the example's anchor, `#example-<id>`. */
  protected readonly headingId = computed(() => `example-${this.example().id}`);
  /** The names of the kit parts the file imports. */
  protected readonly shows = computed(() =>
    this.example().shows.map((shown) => shown.slice(shown.indexOf('#') + 1)),
  );
}
