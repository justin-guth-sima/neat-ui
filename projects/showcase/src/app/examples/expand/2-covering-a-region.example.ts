import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatExpand, type NeatExpandRegion, NeatIcon } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { MLA_USAGE, percent, TIMES } from './data';

/** What the choice names: a region of the kit's, or the board card around the chart. */
type Cover = Exclude<NeatExpandRegion, HTMLElement> | 'card';

/**
 * A card that covers the region the choice above it names: the whole window, the shell's content
 * area, the page's body, or the board card around it. Over the content area the rail and the top
 * bar stay; over the body the side panel stays beside it.
 *
 * Pick a region, then press Expand. Open the side panel, resize the window, or scroll the page
 * while it is expanded: the card follows its region.
 */
@Component({
  selector: 'app-covering-a-region',
  imports: [NeatButton, NeatCard, NeatExpand, NeatIcon, NeatSegmented, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-covering-a-region.example.html',
  styleUrl: './covering-a-region.example.css',
})
export class CoveringARegion {
  protected readonly usage = MLA_USAGE;
  protected readonly times = TIMES;
  protected readonly percent = percent;
  protected readonly cover = signal<Cover>('body');
  protected readonly covers: readonly NeatSegmentedOption<Cover>[] = [
    { value: 'window', label: 'Window' },
    { value: 'content', label: 'Content area' },
    { value: 'body', label: 'Page body' },
    { value: 'card', label: 'Card' },
  ];
  /** The board card's element: a region the app names is an element, not a component. */
  private readonly board = viewChild.required('board', { read: ElementRef<HTMLElement> });
  protected readonly region = computed<NeatExpandRegion>(() => {
    const cover = this.cover();
    return cover === 'card' ? this.board().nativeElement : cover;
  });
}
