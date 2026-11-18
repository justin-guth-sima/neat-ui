import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

/**
 * Inline buttons set into a note and into the lines of a list, each taking the size and color of
 * its line. The actions do nothing; the third list line's is disabled, and the link leads back to
 * this page.
 *
 * @gallery
 */
@Component({
  selector: 'app-in-a-line',
  imports: [NeatInlineButton, NeatLine, NeatLineEnd, NeatLineList, NeatNote, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-in-a-line.example.html',
  styleUrl: './in-a-line.example.css',
})
export class InALine {}
