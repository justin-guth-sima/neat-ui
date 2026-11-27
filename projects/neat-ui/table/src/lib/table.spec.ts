import helmTable from '../../../src/lib/ui/table/src/lib/hlm-table.ts?source' with {
  loader: 'text',
};
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
      expect.arrayContaining(['w-full', 'border-collapse', 'text-sm']),
    );
  });

  it('rules every row off below and fills it under the pointer, expanded or selected, but for the last of the body', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr)]:border-b',
        '[&_:where(tr)]:border-border',
        '[&_:where(tr:hover)]:bg-muted/50',
        '[&_:where(tr[data-state=selected])]:bg-muted',
        '[&_:where(tr:has([aria-expanded=true]))]:bg-muted/50',
      ]),
    );
  });

  it('sizes header cells and pads cells, every th, a row heading too, medium-weight', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(th)]:h-10',
        '[&_:where(th)]:px-2',
        '[&_:where(th)]:font-medium',
        '[&_:where(th)]:text-foreground',
        '[&_:where(td)]:p-2',
        '[&_:where(th,td)]:align-middle',
        '[&_:where(thead_th)]:whitespace-nowrap',
      ]),
    );
    // A row heading is a `th`, so one rule gives it the head cell's weight.
    expect(classesOf(table).some((name) => /th\[scope/.test(name))).toBe(false);
  });

  it('wraps body cells, keeps column headings and figures on one line', async () => {
    const { table } = await render();

    const nowrap = classesOf(table).filter((name) => name.endsWith(':whitespace-nowrap'));
    expect(nowrap.sort()).toEqual([
      '[&_:where([data-figure])]:whitespace-nowrap',
      '[&_:where(thead_th)]:whitespace-nowrap',
    ]);
  });

  it('gives each cell exactly one alignment: start but for the numeric cells, which end-align', async () => {
    const { table } = await render();

    const alignments = classesOf(table).filter((name) => /:text-(start|end)$/.test(name));
    expect(alignments.sort()).toEqual([
      '[&_:where([data-numeric])]:text-end',
      '[&_:where(th,td):where(:not([data-numeric]))]:text-start',
    ]);
  });

  it('gives figures tabular digits, once for figures and numeric cells alike', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining(['[&_:where([data-figure])]:tabular-nums']),
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

  it('helm drift: every class the table takes from helm’s table is still in helm’s file', async () => {
    const { table } = await render();
    // helm class on its element -> the kit's rule on the plain element.
    const TAKEN: Record<string, string[]> = {
      'w-full caption-bottom text-sm': ['w-full', 'caption-bottom', 'text-sm'],
      // Both stand in the one rule: ruled rows but the last of the body.
      '[&_tr]:border-b': ['[&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr)]:border-b'],
      '[&_tr:last-child]:border-0': [
        '[&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr)]:border-b',
      ],
      'hover:bg-muted/50': ['[&_:where(tr:hover)]:bg-muted/50'],
      'data-[state=selected]:bg-muted': ['[&_:where(tr[data-state=selected])]:bg-muted'],
      'border-b transition-colors': ['[&_:where(tr)]:transition-colors'],
      'has-aria-expanded:bg-muted/50': ['[&_:where(tr:has([aria-expanded=true]))]:bg-muted/50'],
      'text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap': [
        '[&_:where(th)]:text-foreground',
        '[&_:where(th)]:h-10',
        '[&_:where(th)]:px-2',
        '[&_:where(th)]:font-medium',
        '[&_:where(thead_th)]:whitespace-nowrap',
        '[&_:where(th,td)]:align-middle',
        '[&_:where(th,td):where(:not([data-numeric]))]:text-start',
      ],
      'p-2 align-middle whitespace-nowrap': ['[&_:where(td)]:p-2'],
      'text-muted-foreground mt-4 text-sm': [
        '[&_:where(caption)]:text-muted-foreground',
        '[&_:where(caption)]:mt-4',
        '[&_:where(caption)]:text-sm',
      ],
    };
    for (const [helmClasses, kitClasses] of Object.entries(TAKEN)) {
      expect(helmTable, helmClasses).toContain(helmClasses);
      expect(classesOf(table), helmClasses).toEqual(expect.arrayContaining(kitClasses));
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
    const PARTS = ['heading', 'caption'] as const;
    const VOCABULARY = {
      dark: 'dark',
      '[&_:where(th)]': 'heading',
      '[&_:where(caption)]': 'caption',
    };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);

      it(`${scheme}: the headings and the caption reach 4.5:1 on the surfaces`, async () => {
        const { table } = await render();
        for (const [surface, part] of SURFACES.flatMap((s) => PARTS.map((p) => [s, p] as const))) {
          const under = tokens[surface];
          const on = scheme === 'dark' ? ['dark', part] : [part];
          const text = stateColor(
            classesOf(table),
            'text',
            { tokens, vocabulary: VOCABULARY, on },
            under,
            tokens['foreground'],
          );
          expect(contrastRatio(text, under), `${part} on --${surface}`).toBeGreaterThanOrEqual(4.5);
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
