import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatNumeric, NeatTable } from './table';

@Component({
  imports: [NeatTable, NeatNumeric],
  template: `
    <table neatTable class="host-class" aria-label="Metrics">
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col" neatNumeric>Mean</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Power</th>
          <td neatNumeric>12.5 W</td>
        </tr>
      </tbody>
    </table>
  `,
})
class TableHost {}

async function render() {
  const fixture = TestBed.createComponent(TableHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const query = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  return {
    table: query('table'),
    name: query('thead th:first-child'),
    mean: query('th[scope=col]:last-child'),
    value: query('td'),
  };
}

const classesOf = (element: HTMLElement) => [...element.classList];

describe('NeatTable', () => {
  it('fills its container with collapsed borders in the small text size', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining(['w-full', 'border-collapse', 'text-(length:--neat-text-sm)']),
    );
  });

  it('pads every cell by the layout tokens and rules it off below, start-aligned and centred', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(th,td)]:px-(--neat-space-3)',
        '[&_:where(th,td)]:py-(--neat-space-2)',
        '[&_:where(th,td)]:border-be',
        '[&_:where(th,td)]:border-border',
        '[&_:where(th,td)]:text-start',
        '[&_:where(th,td)]:align-middle',
      ]),
    );
  });

  it('weights header cells and sets the column headings muted and small', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(th)]:font-medium',
        '[&_:where(thead_th)]:text-muted-foreground',
        '[&_:where(thead_th)]:text-(length:--neat-text-xs)',
      ]),
    );
  });

  it('states the cell defaults without specificity, so a table can adjust one plainly', async () => {
    const { table } = await render();

    // `:where` weighs nothing: an app's own `th` or `.cell` rule needs no heavier selector.
    const defaults = classesOf(table).filter((name) => name.startsWith('[&_'));
    const numeric = defaults.filter((name) => name.includes('[data-numeric]'));
    expect(defaults.filter((name) => !numeric.includes(name) && !name.includes(':where('))).toEqual(
      [],
    );
  });

  it('lets the numeric cells end-align by the specificity of their attribute, not by order', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_[data-numeric]]:text-end',
        '[&_[data-numeric]]:whitespace-nowrap',
        '[&_[data-numeric]]:tabular-nums',
      ]),
    );
  });

  it('keeps classes the app sets alongside its own, and leaves the table a native table', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(expect.arrayContaining(['host-class', 'w-full']));
    expect(table.getAttribute('role')).toBeNull();
    expect(table.getAttribute('aria-label')).toBe('Metrics');
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const SURFACES = ['background', 'card'] as const;
    const VOCABULARY = { dark: 'dark', '[&_:where(thead_th)]': 'heading' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);

      it(`${scheme}: the column headings reach 4.5:1 on the surfaces`, async () => {
        const { table } = await render();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const on = scheme === 'dark' ? ['dark', 'heading'] : ['heading'];
          const text = stateColor(
            classesOf(table),
            'text',
            { tokens, vocabulary: VOCABULARY, on },
            under,
            tokens['foreground'],
          );
          expect(contrastRatio(text, under), `heading on --${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});

describe('NeatNumeric', () => {
  it('marks a cell, header or body, as numeric for the table to align', async () => {
    const { mean, value, name } = await render();

    expect(mean.hasAttribute('data-numeric')).toBe(true);
    expect(value.hasAttribute('data-numeric')).toBe(true);
    expect(name.hasAttribute('data-numeric')).toBe(false);
  });
});
