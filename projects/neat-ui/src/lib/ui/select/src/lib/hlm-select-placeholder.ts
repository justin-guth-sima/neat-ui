import { Directive } from '@angular/core';
import { BrnSelectPlaceholder } from '@spartan-ng/brain/select';
import { classes } from '../../../utils/src';

@Directive({
  selector: '[hlmSelectPlaceholder],hlm-select-placeholder',
  exportAs: 'hlmSelectPlaceholder',
  hostDirectives: [BrnSelectPlaceholder],
  host: { 'data-slot': 'select-placeholder' },
})
export class HlmSelectPlaceholder {
  constructor() {
    classes(
      () =>
        "gap-2 [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] flex items-center data-hidden:hidden [&_neat-icon]:pointer-events-none [&_neat-icon]:shrink-0",
    );
  }
}
