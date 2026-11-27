import { Directive, input } from '@angular/core';
import { classes } from '../../../utils/src';
import { cva, type VariantProps } from 'class-variance-authority';

const alertVariants = cva(
  "grid gap-0.5 rounded-lg border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>neat-icon]:grid-cols-[auto_1fr] has-[>neat-icon]:gap-x-2.5 *:[neat-icon]:row-span-2 *:[neat-icon]:translate-y-0.5 *:[neat-icon]:text-current *:[neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] group/alert relative w-full",
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[neat-icon]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertVariants = VariantProps<typeof alertVariants>;

@Directive({
  selector: 'hlm-alert,[hlmAlert]',
  exportAs: 'hlmAlert',
  host: {
    'data-slot': 'alert',
    role: 'alert',
  },
})
export class HlmAlert {
  public readonly variant = input<AlertVariants['variant']>('default');

  constructor() {
    classes(() => alertVariants({ variant: this.variant() }));
  }
}
