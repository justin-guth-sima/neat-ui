import { NeatIcon } from '../../../../icon/icon';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrnSelectScrollUp } from '@spartan-ng/brain/select';
import { classes } from '../../../utils/src';

@Component({
  selector: 'hlm-select-scroll-up',
  exportAs: 'hlmSelectScrollUp',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnSelectScrollUp],
  template: ` <neat-icon name="collapse" [size]="16" /> `,
})
export class HlmSelectScrollUp {
  constructor() {
    classes(
      () =>
        "bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] sticky top-0 w-full data-hidden:hidden",
    );
  }
}
