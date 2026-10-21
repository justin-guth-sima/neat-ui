import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { NEAT_ICONS, NeatIconName } from './icon-registry';

/**
 * An icon from the kit's curated set. Decorative by default (hidden from assistive technology);
 * give it a `label` when it carries meaning on its own. It takes its colour from the surrounding
 * text.
 */
@Component({
  selector: 'neat-icon',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [lucideIcon]="glyph()"
      [size]="size()"
      [title]="label()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() ?? null"
    ></svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class NeatIcon {
  readonly name = input.required<NeatIconName>();
  /** Edge length in pixels. */
  readonly size = input(20);
  /** Accessible name; leave unset for a decorative icon. */
  readonly label = input<string>();

  protected readonly glyph = computed(() => NEAT_ICONS[this.name()]);
}
