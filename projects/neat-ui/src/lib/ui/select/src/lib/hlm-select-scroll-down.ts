import { NeatIcon } from '../../../../icon/icon';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrnSelectScrollDown } from '@spartan-ng/brain/select';
import { classes } from '../../../utils/src';

@Component({
  selector: 'hlm-select-scroll-down',
  exportAs: 'hlmSelectScrollDown',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnSelectScrollDown],
  template: ` <neat-icon name="expand" [size]="16" /> `,
})
export class HlmSelectScrollDown {
  constructor() {
    classes(
      () =>
        "bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] sticky bottom-0 w-full data-hidden:hidden",
    );
  }
}
