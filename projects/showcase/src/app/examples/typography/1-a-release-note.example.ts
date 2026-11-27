import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  NeatBlockquote,
  NeatCode,
  NeatH1,
  NeatH2,
  NeatH3,
  NeatH4,
  NeatLarge,
  NeatLead,
  NeatMuted,
  NeatP,
  NeatSmall,
  NeatUl,
} from '@sima/neat-ui';

/**
 * A short page set element by element: each heading, paragraph, list and quote takes its own
 * typography directive, and inline code is `neatCode`. The directives set the look; the space
 * between the blocks is the page's, in its stylesheet, as `neatProse` spaces them.
 *
 * For a container of plain HTML, such as a README, `neatProse` gives the same look.
 */
@Component({
  selector: 'app-a-release-note',
  imports: [
    NeatBlockquote,
    NeatCode,
    NeatH1,
    NeatH2,
    NeatH3,
    NeatH4,
    NeatLarge,
    NeatLead,
    NeatMuted,
    NeatP,
    NeatSmall,
    NeatUl,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-a-release-note.example.html',
  styleUrl: './typography.example.css',
})
export class AReleaseNote {}
