import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type NeatTone, ɵbadgeButtonClasses, ɵbadgeClasses } from '@sima/neat-ui';
import { NeatBadge, NeatBadgeButton, type NeatBadgeVariant } from './badge';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
const VARIANTS: NeatBadgeVariant[] = ['soft', 'solid'];

@Component({
  imports: [NeatBadge, NeatBadgeButton],
  template: `
    <neat-badge class="host-class" [tone]="tone()" [variant]="variant()">Live</neat-badge>
    <neat-badge>Idle</neat-badge>
    <button
      neatBadge
      type="button"
      [tone]="tone()"
      [variant]="variant()"
      (click)="presses = presses + 1"
    >
      Metadata late
    </button>
  `,
})
class BadgeHost {
  readonly tone = signal<NeatTone>('success');
  readonly variant = signal<NeatBadgeVariant>('soft');
  presses = 0;
}

async function render() {
  const fixture = TestBed.createComponent(BadgeHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const [badge, plain] = Array.from(root.querySelectorAll<HTMLElement>('neat-badge'));
  return {
    fixture,
    host: fixture.componentInstance,
    badge,
    plain,
    button: root.querySelector<HTMLButtonElement>('button')!,
  };
}

const classesOf = (element: HTMLElement) => [...element.classList];
const listOf = (classes: string) => classes.split(' ');

describe('NeatBadge', () => {
  it('shows its content in the badge’s look: neutral and soft by default', async () => {
    const { badge, plain } = await render();

    expect(badge.textContent?.trim()).toBe('Live');
    expect(badge.getAttribute('data-slot')).toBe('badge');
    expect(classesOf(plain)).toEqual(
      expect.arrayContaining(listOf(ɵbadgeClasses('neutral', 'soft'))),
    );
  });

  it('takes the classes of its tone and variant, and follows a change of either', async () => {
    const { fixture, host, badge } = await render();

    for (const variant of VARIANTS) {
      for (const tone of TONES) {
        host.variant.set(variant);
        host.tone.set(tone);
        await fixture.whenStable();
        expect(classesOf(badge), `${variant} ${tone}`).toEqual(
          expect.arrayContaining(listOf(ɵbadgeClasses(tone, variant))),
        );
      }
    }
    expect(classesOf(badge)).not.toContain('bg-success');
  });

  it('keeps classes the app sets alongside its own', async () => {
    const { badge } = await render();

    expect(classesOf(badge)).toEqual(
      expect.arrayContaining(['host-class', 'bg-neat-tint-success-accent']),
    );
  });

  describe('as a button', () => {
    it('takes the badge button’s classes of its tone and variant', async () => {
      const { fixture, host, button } = await render();

      for (const variant of VARIANTS) {
        for (const tone of TONES) {
          host.variant.set(variant);
          host.tone.set(tone);
          await fixture.whenStable();
          expect(classesOf(button).sort(), `${variant} ${tone}`).toEqual(
            listOf(ɵbadgeButtonClasses(tone, variant)).sort(),
          );
        }
      }
    });

    it('stays a button that is pressed like any, named by its text', async () => {
      const { host, button } = await render();

      expect(button.getAttribute('data-slot')).toBe('badge');
      expect(button.textContent?.trim()).toBe('Metadata late');
      button.click();
      expect(host.presses).toBe(1);
      expect(button.tabIndex).toBe(0);
    });
  });
});
