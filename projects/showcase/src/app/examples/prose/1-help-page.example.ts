import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatProse } from '@sima/neat-ui';

/**
 * A page of help as prose: headings, paragraphs, lists, a link, code, keys, a quote and a rule.
 * Only the container is marked `neatProse`. The elements inside are plain HTML.
 *
 * For an app's own shortcut, `neat-shortcut` shows the keys a Mac has. A `kbd` here shows the one
 * set of keys it is given.
 */
@Component({
  selector: 'app-help-page',
  imports: [NeatProse],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-help-page.example.html',
  styleUrl: './prose.example.css',
})
export class HelpPage {}
