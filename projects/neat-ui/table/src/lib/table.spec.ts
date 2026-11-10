import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatFigure, NeatNumeric, NeatTable } from './table';

@Component({
  imports: [NeatTable, NeatNumeric, NeatFigure],
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
          <td neatFigure>12.51 W <span>OK</span></td>
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
    figure: query('td[data-figure]:not([data-numeric])'),
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

  it('pads every cell by the layout tokens and rules it off below, centered', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(th,td)]:px-(--neat-space-3)',
        '[&_:where(th,td)]:py-(--neat-space-2)',
        '[&_:where(th,td)]:border-be',
        '[&_:where(th,td)]:border-border',
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

  it('gives each cell exactly one alignment: start but for the numeric cells, which end-align', async () => {
    const { table } = await render();

    const alignments = classesOf(table).filter((name) => /:text-(start|end)$/.test(name));
    expect(alignments.sort()).toEqual([
      '[&_:where([data-numeric])]:text-end',
      '[&_:where(th,td):where(:not([data-numeric]))]:text-start',
    ]);
  });

  it('keeps a figure on one line with tabular digits, once for figures and numeric cells alike', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where([data-figure])]:whitespace-nowrap',
        '[&_:where([data-figure])]:tabular-nums',
      ]),
    );
    expect(classesOf(table).filter((name) => name.includes('tabular-nums'))).toHaveLength(1);
  });

  it('states every rule at the weight of its element selector, with nothing outweighing another', async () => {
    const { table } = await render();

    // Each child variant's selector sits wholly in `:where`, so it adds no class or attribute to
    // the specificity: a rule of an app's own is not outweighed by the kit's defaults, and no
    // default is outweighed by another (the kit's utilities are also layered, below component CSS).
    const rules = classesOf(table).filter((name) => name.startsWith('[&_'));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const selector = rule.slice(0, rule.lastIndexOf(']:') + 1);
      const outsideWhere = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
      expect(outsideWhere, rule).toBe('[&_]');
    }
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

describe('NeatFigure and NeatNumeric', () => {
  it('mark a cell as a figure, and only a numeric cell as end-aligned', async () => {
    const { mean, value, figure, name } = await render();

    expect(mean.hasAttribute('data-figure')).toBe(true);
    expect(mean.hasAttribute('data-numeric')).toBe(true);
    expect(value.hasAttribute('data-numeric')).toBe(true);
    expect(figure.hasAttribute('data-figure')).toBe(true);
    expect(figure.hasAttribute('data-numeric')).toBe(false);
    expect(name.hasAttribute('data-figure')).toBe(false);
    expect(name.hasAttribute('data-numeric')).toBe(false);
  });
});
