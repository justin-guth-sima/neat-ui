import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';

/**
 * Helm's switch classes (`lib/ui/switch`), copied because helm keeps them inline rather than as
 * constants. switch.spec checks that each string still appears in the vendored helm, so a helm
 * update that changes one fails until this table is reviewed.
 *
 * Helm puts the track classes on its focusable button. Here the host button holds the label as
 * well, so the track is a span inside it, and the track's focus and validation classes never
 * match: the host draws the focus ring instead.
 */
export const SWITCH_HELM_CLASSES = {
  /** `hlm-switch.ts`: the track, which carries `data-state` and `data-size` as brain's button does. */
  track:
    'data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 dark:data-unchecked:bg-input/80 rounded-full border border-transparent shadow-xs focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] group/switch inline-flex shrink-0 items-center transition-all outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
  /** `hlm-switch-thumb.ts` */
  thumb:
    'bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-unchecked:translate-x-0 data-checked:ltr:translate-x-[calc(100%-2px)] data-checked:rtl:-translate-x-[calc(100%-2px)] pointer-events-none block ring-0 transition-transform',
} as const;

/**
 * The host: the track, then the label, in one row that is a single click target. The focus ring is
 * the kit's (as on `neatButton`): full `--ring`, which the theme holds to 3:1 on every surface,
 * where helm's `ring-ring/50` reaches about 1.85:1 on white.
 */
const HOST_CLASSES =
  'inline-flex items-center gap-2 rounded-md text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * An on/off switch on a native button: `<button neatSwitch [(checked)]="bars">Bars</button>`. The
 * content is the visible label and the accessible name; without content, give it an `aria-label`.
 * Space and Enter toggle it as they click any button.
 *
 * A component rather than a directive on brain's switch: brain's switch is itself a component that
 * renders its own button, so it cannot sit on this one. The host is the native button, which
 * brings focus, keyboard activation and `disabled`; the switch adds the role, the state and the
 * track drawn with helm's classes.
 */
@Component({
  // An attribute selector keeps the native button as the host, as `button[neatButton]` does.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[neatSwitch]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'switch',
    type: 'button',
    role: 'switch',
    '[attr.aria-checked]': 'checked()',
    '[disabled]': 'disabled()',
    '[class]': 'hostClasses',
    '(click)': 'toggle()',
  },
  template: `
    <span
      data-slot="switch-track"
      data-size="default"
      aria-hidden="true"
      [attr.data-state]="state()"
      [class]="trackClasses"
    >
      <span data-slot="switch-thumb" [attr.data-state]="state()" [class]="thumbClasses"></span>
    </span>
    <ng-content />
  `,
})
export class NeatSwitch {
  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly hostClasses = HOST_CLASSES;
  protected readonly trackClasses = SWITCH_HELM_CLASSES.track;
  protected readonly thumbClasses = SWITCH_HELM_CLASSES.thumb;
  protected readonly state = computed(() => (this.checked() ? 'checked' : 'unchecked'));

  protected toggle(): void {
    this.checked.update((checked) => !checked);
  }
}
