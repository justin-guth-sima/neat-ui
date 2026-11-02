import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

/**
 * Inline buttons set into a note and into the lines of a list, each taking the size and colour of
 * its line. The actions do nothing; the third list line's is disabled, and the link leads back to
 * this page.
 */
@Component({
  selector: 'app-in-a-line',
  imports: [NeatInlineButton, NeatLine, NeatLineEnd, NeatLineList, NeatNote, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <p neatNote>
        Overridden on 2 channels ·
        <button neatInlineButton type="button">Show</button>
      </p>
      <ul neatLineList>
        <li neatLine>
          Channel 3 <span class="showcase-muted">900 ms</span>
          <button neatInlineButton neatLineEnd type="button">Use global</button>
        </li>
        <li neatLine>
          Channel 7 <span class="showcase-muted">600 ms</span>
          <button neatInlineButton neatLineEnd type="button">Use global</button>
        </li>
        <li neatLine>
          <button neatInlineButton type="button" disabled>Reset on 2 channels…</button>
        </li>
        <li neatLine>
          <a neatInlineButton routerLink="/components/inline-button">This page</a>
        </li>
      </ul>
    </div>
  `,
  styleUrl: './in-a-line.example.css',
})
export class InALine {}
