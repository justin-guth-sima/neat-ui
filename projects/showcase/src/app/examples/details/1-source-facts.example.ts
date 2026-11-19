import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCopyButton } from '@sima/neat-ui/code-block';
import { NeatDetails } from '@sima/neat-ui/details';

/**
 * The facts of a source in a panel's width. The URL's value holds a code span and its Copy
 * button.
 *
 * @gallery
 */
@Component({
  selector: 'app-source-facts',
  imports: [NeatDetails, NeatCopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-source-facts.example.html',
  styleUrls: ['./panel.css', './source-facts.example.css'],
})
export class SourceFacts {}
