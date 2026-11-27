import { Directive } from '@angular/core';
import { classes } from '../../../utils/src';

@Directive({
  selector: '[hlmInputGroupText],hlm-input-group-text',
  exportAs: 'hlmInputGroupText',
})
export class HlmInputGroupText {
  constructor() {
    classes(
      () =>
        "text-muted-foreground gap-2 text-sm [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] flex items-center [&_neat-icon]:pointer-events-none",
    );
  }
}
