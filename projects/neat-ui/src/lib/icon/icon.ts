import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon, type LucideIconData } from '@lucide/angular';
import { NEAT_ICONS, NeatIconGlyph, NeatIconName } from './icon-registry';

/**
 * An icon from the kit's set, named for what it means.
 *
 * ```html
 * <neat-icon name="info" />
 * ```
 *
 * Where no name of the set fits, give it a glyph from `@sima/neat-ui/lucide` instead:
 * `<neat-icon [name]="Rocket" />`, with `Rocket` imported from that entry point.
 *
 * An icon is decorative by default, hidden from assistive technology. Give it a `label` when it
 * carries meaning on its own. It takes its color from the surrounding text.
 *
 * The `spinner` turns, and stays still for a user who asked for reduced motion. It says nothing
 * of waiting, so the control it sits in does, with `aria-busy` or a held state.
 */
@Component({
  selector: 'neat-icon',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The stylesheet's hook for the one glyph that moves.
  host: { '[attr.data-icon]': 'kitName()' },
  template: `
    <svg
      [lucideIcon]="glyph()"
      [size]="size()"
      [title]="label()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() ?? null"
    ></svg>
  `,
  styleUrl: './icon.css',
})
export class NeatIcon {
  /**
   * Which glyph to draw: a name of the kit's set (`NEAT_ICON_NAMES` lists them all) first, and
   * only where none fits a glyph imported from `@sima/neat-ui/lucide`.
   */
  readonly name = input.required<NeatIconName | NeatIconGlyph>();
  /** Edge length in pixels. */
  readonly size = input(20);
  /** Accessible name; leave unset for a decorative icon. */
  readonly label = input<string>();

  /** The kit's name, null for a glyph given as a drawing; the stylesheet's hook is by name. */
  protected readonly kitName = computed(() => {
    const name = this.name();
    return typeof name === 'string' ? name : null;
  });
  protected readonly glyph = computed((): LucideIconData => {
    const name = this.name();
    return typeof name === 'string' ? NEAT_ICONS[name] : { name: 'glyph', node: name };
  });
}
