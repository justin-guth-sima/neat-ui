import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CodeBox } from './code-box';
import type { DocBlock, DocSpan } from './model';
import { PartRef } from './part-ref';

/**
 * Running text of a doc comment: plain and strong text, code spans, and references, each a link
 * to its part. Every text is its own node on one line, so nothing adds a space between spans.
 */
@Component({
  selector: 'app-doc-spans',
  imports: [PartRef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (span of spans(); track $index) {
      @switch (span.kind) {
        @case ('text') {
          @if (span.strong) {
            <strong>{{ span.text }}</strong>
          } @else {
            <ng-container>{{ span.text }}</ng-container>
          }
        }
        @case ('code') {
          @if (span.strong) {
            <strong
              ><code>{{ span.text }}</code></strong
            >
          } @else {
            <code>{{ span.text }}</code>
          }
        }
        @case ('ref') {
          @if (span.strong) {
            <strong
              ><code><app-part-ref [name]="span.name" [label]="span.text" /></code
            ></strong>
          } @else {
            <code><app-part-ref [name]="span.name" [label]="span.text" /></code>
          }
        }
      }
    }
  `,
  styleUrl: './doc-spans.css',
})
export class DocSpans {
  readonly spans = input.required<readonly DocSpan[]>();
}

/** A doc comment's blocks: paragraphs, fenced code and one level of lists. */
@Component({
  selector: 'app-doc-text',
  imports: [CodeBox, DocSpans],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (block of blocks(); track $index) {
      @switch (block.kind) {
        @case ('paragraph') {
          <p><app-doc-spans [spans]="block.spans" /></p>
        }
        @case ('code') {
          <app-code-box [code]="block.code" />
        }
        @case ('list') {
          <ul>
            @for (item of block.items; track $index) {
              <li><app-doc-spans [spans]="item" /></li>
            }
          </ul>
        }
      }
    }
  `,
  styleUrl: './doc-text.css',
})
export class DocText {
  readonly blocks = input.required<readonly DocBlock[]>();
}
