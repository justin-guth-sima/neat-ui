import { Directive } from '@angular/core';
import {
  BrnTooltip,
  type BrnTooltipPosition,
  provideBrnTooltipDefaultOptions,
} from '@spartan-ng/brain/tooltip';
import {
  DEFAULT_TOOLTIP_CONTENT_CLASSES,
  DEFAULT_TOOLTIP_SVG_CLASS,
  tooltipPositionVariants,
} from '../ui/tooltip/src';
import { hlm } from '../ui/utils/src';

export type NeatTooltipPosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * A short text label shown on mouse or pen hover and on keyboard focus, hidden on leave, blur and
 * Escape; the host carries `aria-describedby` while it is shown. It never opens on touch (a tap
 * would trigger the host's action too), so it must not carry anything the host's accessible name
 * does not.
 *
 * `neatTooltip` takes a string only. Its declared type is brain's (`string | TemplateRef | null`)
 * because a host-directive alias keeps the primitive's input type; templates are not supported.
 *
 * Built like helm's tooltip (brain primitive plus helm's classes) rather than on top of it: a host
 * directive cannot re-expose inputs of its own host directives, and every host directive of a
 * public directive becomes public API.
 */
@Directive({
  selector: '[neatTooltip]',
  providers: [
    provideBrnTooltipDefaultOptions({
      svgClasses: DEFAULT_TOOLTIP_SVG_CLASS,
      tooltipContentClasses: DEFAULT_TOOLTIP_CONTENT_CLASSES,
      arrowClasses: (position: BrnTooltipPosition) => hlm(tooltipPositionVariants({ position })),
    }),
  ],
  hostDirectives: [
    {
      directive: BrnTooltip,
      inputs: [
        'brnTooltip: neatTooltip',
        'position: neatTooltipPosition',
        'tooltipDisabled: neatTooltipDisabled',
      ],
    },
  ],
})
export class NeatTooltip {}
