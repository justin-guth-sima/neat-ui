import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { NeatChartCard } from './chart-card';
import cardStyles from './chart-card.css' with { loader: 'text' };
import { CLIPS_OR_STACKS, stylesheet } from './css.testing';
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

/** A selectable card holding controls of its own beside its chart. */
@Component({
  imports: [NeatChartCard],
  template: `
    <neat-chart-card heading="Controls" selectable (activate)="activations = activations + 1">
      <p class="around">
        <button class="own" type="button">Reset</button>
        <a class="own" href="#details"><span>Details</span></a>
        <input class="own" type="checkbox" aria-label="Pin" />
        <select class="own" aria-label="Window">
          <option>4 min</option>
        </select>
      </p>
    </neat-chart-card>
  `,
})
class ControlsHost {
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

const { rule, declared } = stylesheet(cardStyles);

/** The theme token a `var(--name)` value names. */
const tokenOf = (value: string | undefined): string => /^var\(--([\w-]+)\)$/.exec(value ?? '')![1];

/**
 * The token a text colour comes from: the first of the rules, innermost first, that sets `color`
 * to something but `inherit`, else the card's own (card.spec holds it to `--card-foreground`).
 */
const colorToken = (...chain: string[]): string =>
  tokenOf(
    chain
      .map((selector) => declared(selector, 'color'))
      .concat('var(--card-foreground)')
      .find((color) => color && color !== 'inherit'),
  );

describe('NeatChartCard', () => {
  it('shows the heading with its chip, the value with its unit, the caption and the chart', async () => {
    const { root, one } = await render();

    expect(text(one('[data-slot="card-header"]'))).toBe('MLA temperature Warning');
    expect(text(one('[data-slot="card-header"] .chip'))).toBe('Warning');
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
    const button = one<HTMLButtonElement>('[data-slot="card-header"] button')!;
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('MLA temperature');

    // A click on the heading is one activation, though it bubbles through the card.
    button.click();
    expect(host.activations).toBe(1);

    one('.value')!.click();
    expect(host.activations).toBe(2);
    one('.caption')!.click();
    one('[data-slot="card-header"] .chip')!.click();
    one('neat-time-chart .title')!.click();
    expect(host.activations).toBe(5);
    await fixture.whenStable();
  });

  it('a click on the chart plot activates the card; keys in the plot stay the chart’s', async () => {
    const { host, one } = await render();
    const plot = one('neat-time-chart .plot')!;
    expect(plot.getAttribute('role')).toBe('group');
    expect(plot.getAttribute('tabindex')).toBe('0');

    // The readout follows the pointer without a click, so a click on the plot chooses the card.
    plot.click();
    expect(host.activations).toBe(1);
    // The drawing inside the plot is SVG, which has no `click()`; its clicks bubble all the same.
    for (const drawn of ['svg', '.grid']) {
      one(`neat-time-chart .plot ${drawn}`)!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    }
    expect(host.activations).toBe(3);

    // Keys move the readout and choose nothing: the heading button is the keyboard's way in.
    for (const key of ['ArrowLeft', 'Home', 'End', 'Enter', ' ']) {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(host.activations).toBe(3);
  });

  it('a click inside the stacked chart’s plot or the heatmap’s grid activates its card', async () => {
    const fixture = TestBed.createComponent(OtherChartsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    for (const stop of ['neat-stacked-chart .plot', 'neat-heatmap .grid']) {
      const element = root.querySelector<HTMLElement>(stop)!;
      expect(element.getAttribute('tabindex'), stop).toBe('0');
      element.click();
      element.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    expect(fixture.componentInstance.activations).toBe(4);
  });

  it('a control in the content handles its own click and leaves the card alone', async () => {
    const fixture = TestBed.createComponent(ControlsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    for (const control of ['button.own', 'a.own', 'input.own', 'select.own']) {
      root.querySelector<HTMLElement>(control)!.click();
    }
    root.querySelector('a.own span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fixture.componentInstance.activations).toBe(0);

    // Around the controls, the card is still the card.
    root.querySelector<HTMLElement>('.around')!.click();
    expect(fixture.componentInstance.activations).toBe(1);
  });

  it('marks the selected card with aria-current and the primary outline', async () => {
    const { fixture, host, card, one } = await render((host) => host.selected.set(true));
    const button = one('[data-slot="card-header"] button')!;

    expect(button.getAttribute('aria-current')).toBe('true');
    expect(card.hasAttribute('data-selected')).toBe(true);
    // The selected state is one rule: the 1px border and an inset 1px in --primary make 2px.
    expect(declared(':host([data-selected]) .card', 'border-color')).toBe('var(--primary)');
    expect(declared(':host([data-selected]) .card', 'box-shadow')).toBe(
      'inset 0 0 0 1px var(--primary)',
    );
    // The frame is the card's, in one place: this sheet draws no border of its own.
    expect(declared(':host', 'border')).toBeUndefined();
    expect(declared('.card', 'border')).toBeUndefined();

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

    expect(one('[data-slot="card-header"] button')).toBeNull();
    expect(text(one('[data-slot="card-title"]'))).toBe('MLA temperature');
    expect(card.hasAttribute('data-selectable')).toBe(false);
    // Nothing to select: a stray `selected` shows no outline either.
    expect(card.hasAttribute('data-selected')).toBe(false);

    one('.value')!.click();
    one('[data-slot="card-header"]')!.click();
    card.click();
    expect(host.activations).toBe(0);
  });

  it('leaves the header as tall as its text: the chip needs no 2rem minimum', () => {
    expect(declared('.card', '--neat-card-header-min-height')).toBe('0');
  });

  it('is a neat-card whose title is the heading, with no landmark or heading role and whose header actions hold the chip', async () => {
    const { root, one } = await render();
    const card = one('neat-chart-card > neat-card')!;
    const title = card.querySelector('[data-slot="card-title"]')!;

    expect(root.querySelectorAll('neat-card').length).toBe(1);
    expect(text(title)).toBe('MLA temperature');
    expect(title.querySelector('button.activator')).not.toBeNull();
    // Its accessibility tree is what it was before the card: no landmark, no heading.
    expect(card.hasAttribute('role')).toBe(false);
    expect(card.hasAttribute('aria-labelledby')).toBe(false);
    expect(title.hasAttribute('role')).toBe(false);
    expect(
      root.querySelector('[role="region"], [role="heading"], h1, h2, h3, h4, h5, h6'),
    ).toBeNull();
    expect(text(card.querySelector('[data-slot="card-action"]'))).toBe('Warning');
    // The value, the caption and the chart are the card's content, not its header.
    expect(card.querySelector('[data-slot="card-content"] .value')).not.toBeNull();
    expect(card.querySelector('[data-slot="card-content"] neat-time-chart')).not.toBeNull();
  });

  it('a card that is not selectable has the heading as plain text in the title', async () => {
    const { one } = await render((host) => host.selectable.set(false));
    const title = one('[data-slot="card-title"]')!;

    expect(text(title)).toBe('MLA temperature');
    expect(title.querySelector('button')).toBeNull();
  });

  it('lets charts read --neat-surface as the card fill, and neither clips nor stacks', async () => {
    // Review focus 4: the card sets the surface (card.css) and fills with --card (its class); the
    // chart card sets neither again, and adds nothing that would clip or stack.
    const { root, one } = await render();
    const card = one('neat-card')!;

    expect(card.classList).toContain('bg-card');
    expect(root.querySelector('neat-time-chart')!.closest('neat-card')).toBe(card);
    expect(declared(':host', '--neat-surface')).toBeUndefined();
    expect(declared(':host', 'background')).toBeUndefined();
    expect(rule(':host')).not.toMatch(CLIPS_OR_STACKS);
    expect(declared(':host', 'position')).toBeUndefined();
    // `overflow-visible` is the card's neutraliser of helm's `overflow-hidden`: no clipping.
    expect(card.className).not.toMatch(/overflow-(?!visible)|z-\d|isolat|transform|opacity/);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const card = tokens['card'];

      it(`${scheme}: heading, value, unit and caption text hold 4.5:1 on --card`, () => {
        const texts = {
          heading: colorToken('.activator', ':host'),
          value: colorToken('.value', ':host'),
          unit: colorToken('.unit', '.value', ':host'),
          caption: colorToken('.caption', ':host'),
        };
        for (const [part, token] of Object.entries(texts)) {
          expect(
            contrastRatio(tokens[token], card),
            `${scheme}: ${part} is --${token} ${tokens[token]} on ${card}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${scheme}: the selected outline and the focus ring hold ${MIN_NON_TEXT_CONTRAST}:1 on --card`, () => {
        for (const [what, token] of [
          ['outline', tokenOf(declared(':host([data-selected]) .card', 'border-color'))],
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
