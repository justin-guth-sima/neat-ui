import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type NeatTone, ɵbadgeButtonClasses, ɵbadgeClasses } from '@sima/neat-ui';
import { NeatStatusChip, NeatStatusChipButton, type NeatStatusChipVariant } from './status-chip';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];

/** What each of the chip's variants is in the badge's words. */
const AS_BADGE = { solid: 'solid', tinted: 'soft' } as const;

@Component({
  imports: [NeatStatusChip, NeatStatusChipButton],
  template: `
    <neat-status-chip class="host-class" [tone]="tone()" [variant]="variant()"
      >Live</neat-status-chip
    >
    <neat-status-chip tone="success">Idle</neat-status-chip>
    <button
      neatStatusChip
      type="button"
      [tone]="tone()"
      [variant]="variant()"
      (click)="presses = presses + 1"
    >
      Metadata late
    </button>
    <button neatStatusChip type="button" tone="warning">Late</button>
  `,
})
class ChipHost {
  readonly tone = signal<NeatTone>('success');
  readonly variant = signal<NeatStatusChipVariant>('solid');
  presses = 0;
}

async function render() {
  const fixture = TestBed.createComponent(ChipHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const [chip, plain] = Array.from(root.querySelectorAll<HTMLElement>('neat-status-chip'));
  const [button, plainButton] = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  return { fixture, host: fixture.componentInstance, chip, plain, button, plainButton };
}

const classesOf = (element: HTMLElement) => [...element.classList].sort();
const listOf = (classes: string) => classes.split(' ').sort();

/*
 * The status chip is the badge's deprecated alias for one release: an app that still writes it
 * keeps 0.43's colors and default (`solid`); its shape is the badge's (a 20 px pill, helm's focus
 * ring on the button).
 */
describe('NeatStatusChip, the badge’s deprecated alias', () => {
  it('is solid when it does not ask for a variant, as in 0.43, in the badge’s shape', async () => {
    const { plain, plainButton } = await render();

    expect(classesOf(plain)).toEqual(listOf(ɵbadgeClasses('success', 'solid')));
    expect(classesOf(plainButton)).toEqual(listOf(ɵbadgeButtonClasses('warning', 'solid')));
  });

  it('draws each variant as the badge’s: solid as solid, tinted as soft', async () => {
    const { fixture, host, chip, button } = await render();

    for (const variant of ['solid', 'tinted'] as const) {
      for (const tone of TONES) {
        host.variant.set(variant);
        host.tone.set(tone);
        await fixture.whenStable();
        expect(
          classesOf(chip).filter((name) => name !== 'host-class'),
          `${variant} ${tone}`,
        ).toEqual(listOf(ɵbadgeClasses(tone, AS_BADGE[variant])));
        expect(classesOf(button), `${variant} ${tone}`).toEqual(
          listOf(ɵbadgeButtonClasses(tone, AS_BADGE[variant])),
        );
      }
    }
  });

  it('keeps its own data-slot and the classes the app sets', async () => {
    const { chip, button } = await render();

    expect(chip.getAttribute('data-slot')).toBe('status-chip');
    expect(button.getAttribute('data-slot')).toBe('status-chip');
    expect(classesOf(chip)).toContain('host-class');
  });

  it('stays a button that is pressed like any', async () => {
    const { host, button } = await render();

    button.click();
    expect(host.presses).toBe(1);
    expect(button.tabIndex).toBe(0);
  });
});
