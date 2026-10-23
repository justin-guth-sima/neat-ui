import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import helmGroup from '../../../src/lib/ui/toggle-group/src/lib/hlm-toggle-group.ts?source' with {
  loader: 'text',
};
import helmItem from '../../../src/lib/ui/toggle-group/src/lib/hlm-toggle-group-item.ts?source' with {
  loader: 'text',
};
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatSegmented, type NeatSegmentedOption, SEGMENTED_HELM_CLASSES } from './segmented';

type Shape = 'wide' | 'square' | 'tall';

const OPTIONS: NeatSegmentedOption<Shape>[] = [
  { value: 'wide', label: '16:9', icon: 'aspect-wide' },
  { value: 'square', label: '1:1', icon: 'aspect-square' },
  { value: 'tall', label: '9:16' },
];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/**
 * The variants on a segment's colour classes. Helm's `aria-pressed:` never applies (segments are
 * radios, checked through `data-state`), nor do validation or disabled styles in these states.
 */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
  'data-[state=on]': 'checked',
  'aria-pressed': false,
  'data-[matches-spartan-invalid=true]': false,
  disabled: false,
};

@Component({
  imports: [NeatSegmented],
  template: `
    <neat-segmented
      label="Tile shape"
      [options]="options"
      [disabled]="disabled()"
      [(value)]="shape"
      (valueChange)="changes.push($event)"
    />
  `,
})
class SegmentedHost {
  readonly options = OPTIONS;
  readonly shape = signal<Shape>('wide');
  readonly disabled = signal(false);
  readonly changes: Shape[] = [];
}

async function render(setup: (host: SegmentedHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(SegmentedHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const group = root.querySelector<HTMLElement>('[role="radiogroup"]')!;
  const radios = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  return { fixture, host: fixture.componentInstance, group, radios };
}

const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const checked = (radios: HTMLElement[]) =>
  radios.map((radio) => radio.getAttribute('aria-checked'));
const tabStops = (radios: HTMLElement[]) => radios.map((radio) => radio.tabIndex);

describe('NeatSegmented', () => {
  it('is a radio group named by label, with one radio per option and no pressed state', async () => {
    const { group, radios } = await render();

    expect(group.getAttribute('aria-label')).toBe('Tile shape');
    expect(radios.map((radio) => radio.textContent?.trim())).toEqual(['16:9', '1:1', '9:16']);
    expect(checked(radios)).toEqual(['true', 'false', 'false']);
    for (const radio of radios) {
      expect(radio.type).toBe('button');
      expect(radio.hasAttribute('aria-pressed')).toBe(false);
    }
  });

  it('never takes a pressed state, after a click or an arrow key either', async () => {
    const { fixture, radios } = await render();
    const pressed = () => radios.map((radio) => radio.getAttribute('aria-pressed'));

    radios[1].click();
    await fixture.whenStable();
    expect(pressed()).toEqual([null, null, null]);
    expect(checked(radios)).toEqual(['false', 'true', 'false']);

    key(radios[1], 'ArrowRight');
    await fixture.whenStable();
    expect(pressed()).toEqual([null, null, null]);
    expect(checked(radios)).toEqual(['false', 'false', 'true']);
  });

  it('marks the checked segment with data-state for its styles', async () => {
    const { fixture, host, radios } = await render();
    expect(radios.map((radio) => radio.dataset['state'])).toEqual(['on', 'off', 'off']);

    host.shape.set('tall');
    await fixture.whenStable();
    expect(radios.map((radio) => radio.dataset['state'])).toEqual(['off', 'off', 'on']);
  });

  it('shows an option’s icon before its label, hidden from assistive technology', async () => {
    const { radios } = await render();

    const icon = radios[0].querySelector('neat-icon');
    expect(icon).not.toBeNull();
    // A neat-icon without a label is decorative: its svg is hidden from assistive technology.
    expect(icon?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(radios[0].textContent?.trim()).toBe('16:9');
    expect(radios[2].querySelector('neat-icon')).toBeNull();
  });

  it('has one tab stop: the checked option, or the first when none is checked', async () => {
    const { fixture, host, radios } = await render();
    expect(tabStops(radios)).toEqual([0, -1, -1]);

    host.shape.set('square');
    await fixture.whenStable();
    expect(tabStops(radios)).toEqual([-1, 0, -1]);

    host.shape.set('none' as Shape);
    await fixture.whenStable();
    expect(checked(radios)).toEqual(['false', 'false', 'false']);
    expect(tabStops(radios)).toEqual([0, -1, -1]);
  });

  it('keyboard: arrows move focus and selection, wrapping; Home and End jump to the ends', async () => {
    const { fixture, host, radios } = await render();
    radios[0].focus();

    key(radios[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(document.activeElement).toBe(radios[1]);
    expect(tabStops(radios)).toEqual([-1, 0, -1]);

    key(radios[1], 'ArrowDown');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');

    key(radios[2], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');
    expect(document.activeElement).toBe(radios[0]);

    key(radios[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');

    key(radios[2], 'Home');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');

    key(radios[0], 'End');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');
    expect(document.activeElement).toBe(radios[2]);
    expect(host.changes).toEqual(['square', 'tall', 'wide', 'tall', 'wide', 'tall']);
  });

  it('a click checks an option; clicking the checked one keeps it checked', async () => {
    const { fixture, host, radios } = await render();

    radios[1].click();
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(checked(radios)).toEqual(['false', 'true', 'false']);

    radios[1].click();
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(checked(radios)).toEqual(['false', 'true', 'false']);
    expect(host.changes).toEqual(['square']);
  });

  it('focus() focuses the selected segment, the control\u2019s tab stop', async () => {
    const { fixture, host, radios } = await render();
    const segmented: NeatSegmented<Shape> = fixture.debugElement.query(
      By.directive(NeatSegmented),
    ).componentInstance;

    segmented.focus();
    expect(document.activeElement).toBe(radios[0]);

    host.shape.set('tall');
    await fixture.whenStable();
    segmented.focus();
    expect(document.activeElement).toBe(radios[2]);
  });

  it('disabled disables every radio and ignores clicks and arrows', async () => {
    const { fixture, host, radios } = await render((host) => host.disabled.set(true));

    expect(radios.every((radio) => radio.disabled)).toBe(true);
    radios[1].click();
    key(radios[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');
    expect(host.changes).toEqual([]);
  });

  it('draws the group and its segments with helm’s outline toggle-group classes', async () => {
    const { group, radios } = await render();

    expect([...group.classList]).toEqual(
      expect.arrayContaining(SEGMENTED_HELM_CLASSES.group.split(' ')),
    );
    expect(group.dataset['variant']).toBe('outline');
    expect(group.dataset['spacing']).toBe('0');
    expect([...radios[0].classList]).toEqual(
      expect.arrayContaining(['border-input', 'h-9', 'shrink-0', 'focus-visible:z-10']),
    );
  });

  it('helm drift: the copied class strings still appear in the vendored helm toggle group', () => {
    expect(helmGroup).toContain(SEGMENTED_HELM_CLASSES.group);
    expect(helmItem).toContain(SEGMENTED_HELM_CLASSES.item);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);
      const text = (surface: (typeof SURFACES)[number]) =>
        tokens[surface === 'card' ? 'card-foreground' : 'foreground'];

      async function segmentClasses(): Promise<string[]> {
        const { radios } = await render();
        return [...radios[0].classList];
      }

      it(`${scheme}: a segment's border reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const classes = await segmentClasses();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const border = stateColor(classes, 'border', q(on()), under);
          expect(
            contrastRatio(border, under),
            `${scheme}, border on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: the checked segment's fill reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, at rest and on hover`, async () => {
        const classes = await segmentClasses();
        for (const hover of [[], ['hover']]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor(classes, 'bg', q(on('checked', ...hover)), under);
            expect(
              contrastRatio(fill, under),
              `${scheme}, checked ${hover.join('')} on --${surface}: ${fill}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: labels reach 4.5:1 unchecked and checked, at rest and on hover`, async () => {
        const classes = await segmentClasses();
        for (const state of [[], ['checked']]) {
          for (const hover of [[], ['hover']]) {
            for (const surface of SURFACES) {
              const under = tokens[surface];
              const states = on(...state, ...hover);
              const fill = stateColor(classes, 'bg', q(states), under);
              const label = stateColor(classes, 'text', q(states), fill, text(surface));
              expect(
                contrastRatio(label, fill),
                `${scheme}, [${states.join(', ')}] on --${surface}: ${label} on ${fill}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      });

      it(`${scheme}: an unchecked segment's hover fill is visible (${MIN_FILL_CONTRAST}:1) on background and card`, async () => {
        const classes = await segmentClasses();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const fill = stateColor(classes, 'bg', q(on('hover')), under);
          expect(
            contrastRatio(fill, under),
            `${scheme}, hover on --${surface}: ${fill}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const classes = await segmentClasses();
        expect(classes).toContain('focus-visible:ring-[3px]');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(classes, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
