import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmSwitch from '../../../src/lib/ui/switch/src/lib/hlm-switch.ts?source' with {
  loader: 'text',
};
import helmThumb from '../../../src/lib/ui/switch/src/lib/hlm-switch-thumb.ts?source' with {
  loader: 'text',
};
import { contrastRatio } from '../../../src/lib/theme/color';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor, stateValue } from '../../../src/lib/theme/state-colors';
import type { NeatColorScheme } from '../../../src/lib/theme/theme.service';
import { NeatSwitch, SWITCH_HELM_CLASSES } from './switch';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;
const STATES = ['unchecked', 'checked'] as const;

/** The variants on the switch's colour classes. Helm draws focus and validity on its button. */
const VOCABULARY = {
  dark: 'dark',
  'data-checked': 'checked',
  'data-unchecked': 'unchecked',
  'focus-visible': 'focus',
  'data-[matches-spartan-invalid=true]': false,
  disabled: false,
};

@Component({
  imports: [NeatSwitch],
  template: `
    <button
      neatSwitch
      class="host-class"
      [class.bound-class]="bound()"
      [(checked)]="checked"
      [disabled]="disabled()"
    >
      Bars
    </button>
    <button neatSwitch aria-label="Hide empty" [checked]="true"></button>
  `,
})
class SwitchHost {
  readonly checked = signal(false);
  readonly disabled = signal(false);
  readonly bound = signal(true);
}

async function render(setup: (host: SwitchHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(SwitchHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const [labelled, iconOnly]: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  );
  const track = labelled.querySelector<HTMLElement>('[data-slot="switch-track"]')!;
  const thumb = labelled.querySelector<HTMLElement>('[data-slot="switch-thumb"]')!;
  return { fixture, host: fixture.componentInstance, button: labelled, iconOnly, track, thumb };
}

describe('NeatSwitch', () => {
  it('is a native button with role switch whose aria-checked follows checked', async () => {
    const { fixture, host, button, track, thumb } = await render();

    expect(button.type).toBe('button');
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(track.dataset['state']).toBe('unchecked');
    expect(thumb.dataset['state']).toBe('unchecked');

    host.checked.set(true);
    await fixture.whenStable();

    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(track.dataset['state']).toBe('checked');
    expect(thumb.dataset['state']).toBe('checked');
  });

  it('toggles on click and writes back through [(checked)]', async () => {
    const { fixture, host, button } = await render();

    button.click();
    await fixture.whenStable();
    expect(host.checked()).toBe(true);
    expect(button.getAttribute('aria-checked')).toBe('true');

    button.click();
    await fixture.whenStable();
    expect(host.checked()).toBe(false);
  });

  it('keyboard: sits in the tab order as a native button, so Space and Enter toggle it', async () => {
    // A native button turns Space and Enter into a click; jsdom does not synthesise that click,
    // so the test checks the parts the browser relies on and then fires the click it would. The
    // keys themselves are checked in a real browser (the task's browser pass).
    const { fixture, host, button } = await render();

    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute('tabindex')).toBeNull();

    button.click();
    await fixture.whenStable();
    expect(host.checked()).toBe(true);
  });

  it('takes its accessible name from its content or aria-label; the track adds nothing', async () => {
    const { button, iconOnly, track } = await render();

    expect(button.textContent?.trim()).toBe('Bars');
    expect(track.getAttribute('aria-hidden')).toBe('true');
    expect(track.textContent?.trim()).toBe('');
    expect(iconOnly.getAttribute('aria-label')).toBe('Hide empty');
    expect(iconOnly.getAttribute('aria-checked')).toBe('true');
  });

  it('disabled reaches the native button and blocks toggling', async () => {
    const { fixture, host, button } = await render((host) => host.disabled.set(true));

    expect(button.disabled).toBe(true);
    button.click();
    await fixture.whenStable();
    expect(host.checked()).toBe(false);

    host.disabled.set(false);
    await fixture.whenStable();
    button.click();
    await fixture.whenStable();
    expect(host.checked()).toBe(true);
  });

  it('keeps classes the host sets via class="…" and [class.x] alongside its own', async () => {
    const { fixture, host, button } = await render();
    expect([...button.classList]).toEqual(
      expect.arrayContaining(['host-class', 'bound-class', 'focus-visible:ring-ring']),
    );

    host.bound.set(false);
    host.checked.set(true);
    await fixture.whenStable();
    expect(button.classList).not.toContain('bound-class');
    expect(button.classList).toContain('host-class');
  });

  it('draws the track and thumb with helm’s switch classes', async () => {
    const { track, thumb } = await render();

    expect([...track.classList]).toEqual(
      expect.arrayContaining(SWITCH_HELM_CLASSES.track.split(' ')),
    );
    expect([...thumb.classList]).toEqual(
      expect.arrayContaining(SWITCH_HELM_CLASSES.thumb.split(' ')),
    );
  });

  it('helm drift: the copied class strings still appear in the vendored helm switch', () => {
    expect(helmSwitch).toContain(SWITCH_HELM_CLASSES.track);
    expect(helmThumb).toContain(SWITCH_HELM_CLASSES.thumb);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });
      const on = (state: string) => (scheme === 'dark' ? ['dark', state] : [state]);

      it(`${scheme}: the track reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, unchecked and checked`, async () => {
        const { track } = await render();
        const classes = [...track.classList];
        for (const state of STATES) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor(classes, 'bg', q(on(state)), under);
            const label = `${scheme}, ${state}, on --${surface}: ${fill} vs ${under}`;
            expect(contrastRatio(fill, under), label).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: the thumb reaches ${MIN_NON_TEXT_CONTRAST}:1 against the track, unchecked and checked`, async () => {
        const { track, thumb } = await render();
        for (const state of STATES) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor([...track.classList], 'bg', q(on(state)), under);
            const knob = stateColor([...thumb.classList], 'bg', q(on(state)), fill);
            const label = `${scheme}, ${state}, on --${surface}: thumb ${knob} vs track ${fill}`;
            expect(contrastRatio(knob, fill), label).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: the focus ring on the host reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { button } = await render();
        const classes = [...button.classList];
        expect(classes).toContain('focus-visible:ring-3');
        // Unfocused, the host draws no ring colour of its own.
        expect(stateValue(classes, 'ring', q(on('rest')))).toBeUndefined();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(classes, 'ring', q(on('focus')), under);
          const label = `${scheme}, focus ring on --${surface}: ${ring} vs ${under}`;
          expect(contrastRatio(ring, under), label).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
