import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/**
 * The facts of a source in a panel's width. The URL's value holds a code span and an inline
 * button.
 *
 * @gallery
 */
@Component({
  selector: 'app-source-facts',
  imports: [NeatDetails, NeatInlineButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-source-facts.example.html',
  styleUrls: ['./panel.css', './source-facts.example.css'],
})
export class SourceFacts {}
