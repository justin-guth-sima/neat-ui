import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatButton, NeatCode, NeatNote } from '@sima/neat-ui';
import { shownName } from './display';
import { DocText } from './doc-text';
import { demoPath } from './docs-routes';
import type { DocsExample } from './model';
import { PartRef } from './part-ref';
import { Snippet } from './snippet';

/**
 * One example of a topic: its title and caption, the parts it shows, the example itself, live,
 * and its code, which is the file that renders above it. The live area is inset from the card's
 * own, or not for an example that fills it (`DocsExample.unpadded`). A page example
 * (`DocsExample.page`) is a link to its own route instead, and an example with no component (the
 * showcase's shell, which the page sits in) is a line saying so; both still show their code.
 */
@Component({
  selector: 'app-example-card',
  imports: [
    DocText,
    NeatButton,
    NeatCode,
    NeatNote,
    NgComponentOutlet,
    PartRef,
    RouterLink,
    Snippet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [attr.aria-labelledby]="headingId()">
      <h3 [id]="headingId()">{{ example().title }}</h3>
      <app-doc-text [blocks]="example().caption" />
      @if (shows().length) {
        <p class="shows" neatNote>
          Shows
          @for (name of shows(); track name) {
            <code neatCode><app-part-ref [name]="name" /></code>
          }
        </p>
      }
      @if (example().page) {
        <p>
          <a neatButton variant="outlined" size="small" [routerLink]="pagePath()">
            Open the example
          </a>
        </p>
      } @else if (example().component; as component) {
        <div class="live" [attr.data-unpadded]="example().unpadded === true">
          <ng-container *ngComponentOutlet="component" />
        </div>
      } @else {
        <p neatNote>Not rendered here: this page already sits in it.</p>
      }
      <app-snippet [files]="example().files" />
    </article>
  `,
  styleUrl: './example-card.css',
})
export class ExampleCard {
  readonly example = input.required<DocsExample>();
  /** The id of the example's topic, for a page example's route. */
  readonly topic = input.required<string>();

  private readonly outlet = viewChild(NgComponentOutlet);

  /** The rendered example's component, once rendered; null when the card only links to it. */
  instance(): unknown {
    return this.outlet()?.componentInstance ?? null;
  }

  /** Also the example's anchor, `#example-<id>`. */
  protected readonly headingId = computed(() => `example-${this.example().id}`);
  /** Where a page example is routed. */
  protected readonly pagePath = computed(() => demoPath(this.topic(), this.example().id));
  /** The names of the kit parts the file imports. */
  protected readonly shows = computed(() => this.example().shows.map(shownName));
}
