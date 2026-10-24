import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { NeatChartCard } from './chart-card';
import cardStyles from './chart-card.css' with { loader: 'text' };
import { NeatHeatmap } from './heatmap';
import { NeatStackedChart } from './stacked-chart';
import { NeatTimeChart } from './time-chart';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];

@Component({
  imports: [NeatChartCard, NeatTimeChart],
  template: `
    <neat-chart-card
      heading="MLA temperature"
      [value]="value()"
      [unit]="unit()"
      [caption]="caption()"
      [selectable]="selectable()"
      [selected]="selected()"
      (activate)="activations = activations + 1"
    >
      <span neatChartCardChip class="chip">Warning</span>
      <neat-time-chart
        label="MLA"
        [series]="[{ key: 'mla', label: 'MLA', values: [50, 60, 62] }]"
        [times]="[0, 60000, 120000]"
        [domain]="[0, 100]"
      />
    </neat-chart-card>
  `,
})
class CardHost {
  readonly value = signal('62.4');
  readonly unit = signal('°C');
  readonly caption = signal('Hottest of 8 sensors');
  readonly selectable = signal(true);
  readonly selected = signal(false);
  activations = 0;
}

/** The other two charts that read out a sample, each in its own selectable card. */
@Component({
  imports: [NeatChartCard, NeatStackedChart, NeatHeatmap],
  template: `
    <neat-chart-card heading="Stacked" selectable (activate)="activations = activations + 1">
      <neat-stacked-chart
        label="CPU"
        [series]="[
          { key: 'a', label: 'A', values: [10, 20] },
          { key: 'b', label: 'B', values: [30, 20] },
        ]"
        [times]="[0, 60000]"
        [domain]="[0, 100]"
      />
    </neat-chart-card>
    <neat-chart-card heading="Heatmap" selectable (activate)="activations = activations + 1">
      <neat-heatmap
        label="Cores"
        [rows]="[{ key: 'c0', label: 'Core 0', values: [10, 90], end: '50%', endTone: 'default' }]"
        [times]="[0, 60000]"
      />
    </neat-chart-card>
  `,
})
class OtherChartsHost {
  activations = 0;
}

async function render(setup: (host: CardHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(CardHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const one = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
  return { fixture, host: fixture.componentInstance, root, card: one('neat-chart-card')!, one };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

/** The declarations of the stylesheet's rule with exactly this selector. */
const rule = (selector: string): string =>
  new RegExp(`(?:^|\\n)${selector.replace(/[()[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(
    cardStyles,
  )?.[1] ?? '';

/** The value a rule declares for a property (not a longhand of it: `color` is not `border-color`). */
const declared = (selector: string, property: string): string | undefined =>
  new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(rule(selector))?.[1];

/** The theme token a `var(--name)` value names. */
const tokenOf = (value: string | undefined): string => /^var\(--([\w-]+)\)$/.exec(value ?? '')![1];

/**
 * The token a text colour comes from: the first of the rules, innermost first, that sets `color`
 * to something but `inherit`.
 */
const colorToken = (...chain: string[]): string =>
  tokenOf(
    chain
      .map((selector) => declared(selector, 'color'))
      .find((color) => color && color !== 'inherit'),
  );

describe('NeatChartCard', () => {
  it('shows the heading with its chip, the value with its unit, the caption and the chart', async () => {
    const { root, one } = await render();

    expect(text(one('.head'))).toBe('MLA temperature Warning');
    expect(text(one('.head .chip'))).toBe('Warning');
    expect(text(one('.value'))).toBe('62.4 °C');
    expect(text(one('.value .unit'))).toBe('°C');
    expect(text(one('.caption'))).toBe('Hottest of 8 sensors');
    // The chart is projected after the caption, below the text.
    expect(one('.caption')!.nextElementSibling).toBe(root.querySelector('neat-time-chart'));
  });

  it('leaves out the value, its unit and the caption while they are empty', async () => {
    const { one } = await render((host) => {
      host.value.set('');
      host.unit.set('°C');
      host.caption.set('');
    });

    expect(one('.value')).toBeNull();
    expect(one('.unit')).toBeNull();
    expect(one('.caption')).toBeNull();
  });

  it('puts the unit only where there is a value, and only when there is a unit', async () => {
    const { one } = await render((host) => host.unit.set(''));

    expect(text(one('.value'))).toBe('62.4');
    expect(one('.unit')).toBeNull();
  });

  it('a selectable card emits activate from its heading button and from a click on the card', async () => {
    const { fixture, host, one } = await render();
    const button = one<HTMLButtonElement>('.head button')!;
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('MLA temperature');

    // A click on the heading is one activation, though it bubbles through the card.
    button.click();
    expect(host.activations).toBe(1);

    one('.value')!.click();
    expect(host.activations).toBe(2);
    one('.caption')!.click();
    one('.head .chip')!.click();
    one('neat-time-chart .title')!.click();
    expect(host.activations).toBe(5);
    await fixture.whenStable();
  });

  it('a click on the chart plot does not activate the card', async () => {
    const { host, one } = await render();
    const plot = one('neat-time-chart .plot')!;
    expect(plot.getAttribute('role')).toBe('group');
    expect(plot.getAttribute('tabindex')).toBe('0');

    plot.click();
    // The drawing inside the plot is SVG, which has no `click()`; its clicks bubble all the same.
    for (const drawn of ['svg', '.grid']) {
      one(`neat-time-chart .plot ${drawn}`)!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    }

    expect(host.activations).toBe(0);
  });

  it('a click inside the stacked chart’s plot or the heatmap’s grid does not activate its card', async () => {
    const fixture = TestBed.createComponent(OtherChartsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    // The same marker as the time chart's plot: a group that is a tab stop of its own.
    for (const stop of ['neat-stacked-chart .plot', 'neat-heatmap .grid']) {
      const element = root.querySelector<HTMLElement>(stop)!;
      expect(element.getAttribute('tabindex'), stop).toBe('0');
      element.click();
      element.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    expect(fixture.componentInstance.activations).toBe(0);

    root.querySelector<HTMLElement>('neat-heatmap .title')!.click();
    expect(fixture.componentInstance.activations).toBe(1);
  });

  it('marks the selected card with aria-current and the primary outline', async () => {
    const { fixture, host, card, one } = await render((host) => host.selected.set(true));
    const button = one('.head button')!;

    expect(button.getAttribute('aria-current')).toBe('true');
    expect(card.hasAttribute('data-selected')).toBe(true);
    // The selected state is one rule: the 1px border and an inset 1px in --primary make 2px.
    expect(declared(':host([data-selected])', 'border-color')).toBe('var(--primary)');
    expect(declared(':host([data-selected])', 'box-shadow')).toBe('inset 0 0 0 1px var(--primary)');
    expect(declared(':host', 'border')).toBe('1px solid var(--border)');

    host.selected.set(false);
    await fixture.whenStable();
    expect(button.hasAttribute('aria-current')).toBe(false);
    expect(card.hasAttribute('data-selected')).toBe(false);
  });

  it('a card that is not selectable has no button and ignores clicks', async () => {
    const { host, card, one } = await render((host) => {
      host.selectable.set(false);
      host.selected.set(true);
    });

    expect(one('.head button')).toBeNull();
    expect(text(one('.head'))).toBe('MLA temperature Warning');
    expect(card.hasAttribute('data-selectable')).toBe(false);
    // Nothing to select: a stray `selected` shows no outline either.
    expect(card.hasAttribute('data-selected')).toBe(false);

    one('.value')!.click();
    one('.head')!.click();
    card.click();
    expect(host.activations).toBe(0);
  });

  it('sets --neat-surface to its fill, and neither clips nor stacks above its neighbours', () => {
    expect(declared(':host', '--neat-surface')).toBe('var(--card)');
    expect(declared(':host', 'background')).toBe('var(--card)');
    // A readout can hang below its plot; any of these would clip it, or make a stacking context
    // that lets the next card paint over it.
    expect(rule(':host')).not.toMatch(
      /(?:^|[;\s])(?:overflow(?:-[xy])?|z-index|isolation|transform|opacity|filter|contain|will-change|mask|clip-path|perspective|backdrop-filter)\s*:/,
    );
    expect(declared(':host', 'position')).toBeUndefined();
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const card = tokens['card'];

      it(`${scheme}: heading, value, unit and caption text hold 4.5:1 on --card`, () => {
        const texts = {
          heading: colorToken('.activator', '.heading', ':host'),
          value: colorToken('.value', ':host'),
          unit: colorToken('.unit', '.value', ':host'),
          caption: colorToken('.caption', ':host'),
        };
        expect(tokenOf(declared(':host', 'background'))).toBe('card');
        for (const [part, token] of Object.entries(texts)) {
          expect(
            contrastRatio(tokens[token], card),
            `${scheme}: ${part} is --${token} ${tokens[token]} on ${card}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${scheme}: the selected outline and the focus ring hold ${MIN_NON_TEXT_CONTRAST}:1 on --card`, () => {
        for (const [what, token] of [
          ['outline', tokenOf(declared(':host([data-selected])', 'border-color'))],
          ['ring', tokenOf(declared('.activator:focus-visible', 'outline')?.split(' ').at(-1))],
        ]) {
          expect(
            contrastRatio(tokens[token], card),
            `${scheme}: ${what} is --${token} ${tokens[token]} on ${card}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
