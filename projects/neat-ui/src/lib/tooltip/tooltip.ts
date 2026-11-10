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

/** The side of its host a tooltip opens on. */
export type NeatTooltipPosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * The kit's tooltip look, as brain's default options, for every element that hosts brain's
 * tooltip: `NeatTooltip`, and the rail item, which hosts it directly because it names its own
 * tooltip. Internal to the kit. `position` is the side the host prefers when its template does not
 * bind one.
 */
export function provideNeatTooltipOptions(position?: NeatTooltipPosition) {
  return provideBrnTooltipDefaultOptions({
    svgClasses: DEFAULT_TOOLTIP_SVG_CLASS,
    tooltipContentClasses: DEFAULT_TOOLTIP_CONTENT_CLASSES,
    arrowClasses: (side: BrnTooltipPosition) => hlm(tooltipPositionVariants({ position: side })),
    ...(position ? { position } : {}),
  });
}

/**
 * A short text label shown on hover and on keyboard focus.
 *
 * ```html
 * <button neatButton type="button" variant="text" iconOnly aria-label="View options"
 *         neatTooltip="View options">
 *   <neat-icon name="more" />
 * </button>
 * ```
 *
 * It shows on mouse or pen hover and on keyboard focus, and hides on leave, blur and Escape. The
 * host carries `aria-describedby` while it is shown.
 *
 * It never opens on touch, since a tap would trigger the host's action too. So it must not carry
 * anything the host's accessible name does not.
 *
 * `neatTooltip` takes a string only. Its declared type is brain's (`string | TemplateRef | null`)
 * because a host-directive alias keeps the primitive's input type; templates are not supported.
 *
 * @input neatTooltip The text to show, which also names the directive: `neatTooltip="Delete"`. A
 * string only; empty shows nothing.
 * @input neatTooltipPosition The side of the host the tooltip prefers, `top` by default; it goes
 * to another side when it has no room there.
 * @input neatTooltipDisabled Turns the tooltip off, for a host that needs none at the moment. An
 * attribute alone means true.
 */
@Directive({
  selector: '[neatTooltip]',
  providers: [provideNeatTooltipOptions()],
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
export class NeatTooltip {
  // Built like helm's tooltip (brain primitive plus helm's classes) rather than on top of it: a
  // host directive cannot re-expose inputs of its own host directives, and every host directive of
  // a public directive becomes public API.
}
