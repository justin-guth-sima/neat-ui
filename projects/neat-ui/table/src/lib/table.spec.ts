import helmTable from '../../../src/lib/ui/table/src/lib/hlm-table.ts?source' with {
  loader: 'text',
};
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_FILL_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { resolveColor, splitVariants, stateColor } from '../../../src/lib/theme/state-colors';
import { classSet, helmHostClasses } from '../../../src/lib/typography/helm-classes.testing';
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
        '[&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr:not(:last-child))]:border-b',
        '[&_:where(tr)]:border-border',
        '[@media(hover:hover)]:[&_:where(tr:hover:not([data-state=selected]))]:bg-accent',
        '[&_:where(tr[data-state=selected])]:bg-accent',
        '[&_:where(tr:has([aria-expanded=true]):not([data-state=selected]))]:bg-accent',
      ]),
    );
  });

  it('leaves the last row of the body and of the footer unruled, by naming the other rows', async () => {
    const { table } = await render();

    const rule = classesOf(table).find((name) => name.endsWith(')]:border-b'))!;
    expect(rule).toContain('tbody_tr:not(:last-child)');
    expect(rule).toContain('tfoot_tr:not(:last-child)');
    expect(rule).toContain('thead_tr');
  });

  it('lets a selected row win over hover and expansion by structure, and hovers only where there is hover', async () => {
    const { table } = await render();

    const fills = classesOf(table).filter((name) => /tr:(hover|has)/.test(name));
    expect(fills).toHaveLength(2);
    for (const name of fills) expect(name, name).toContain(':not([data-state=selected])');
    expect(fills.find((name) => name.includes('tr:hover'))).toMatch(/^\[@media\(hover:hover\)\]:/);
  });

  it('draws the footer as helm does, in the kit’s fill: a rule above, an accent fill, medium weight', async () => {
    const { table } = await render();

    expect(classesOf(table)).toEqual(
      expect.arrayContaining([
        '[&_:where(tfoot)]:border-t',
        '[&_:where(tfoot)]:bg-accent',
        '[&_:where(tfoot)]:font-medium',
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

  it('helm drift: each class of helm’s table parts is taken, mapped or a named departure, and nothing else', async () => {
    const { table } = await render();
    const RULED =
      '[&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr:not(:last-child))]:border-b';
    const START = '[&_:where(th,td):where(:not([data-numeric]))]:text-start';
    /**
     * Per helm directive, each of its classes and the kit's rules that stand for it on the plain
     * element. An empty list is a departure (left out); the fills are mapped to `--accent`, a
     * departure table.ts says why. A class helm adds has no entry and one it drops leaves one, and
     * both fail.
     */
    const TAKEN: Record<string, Record<string, string[]>> = {
      HlmTable: {
        'w-full': ['w-full'],
        'caption-bottom': ['caption-bottom'],
        'text-sm': ['text-sm'],
      },
      // Both stand in the one rule: ruled rows but the last of the body and of the footer.
      HlmTHead: { '[&_tr]:border-b': [RULED] },
      HlmTBody: { '[&_tr:last-child]:border-0': [RULED] },
      HlmTFoot: {
        'bg-muted/50': ['[&_:where(tfoot)]:bg-accent'],
        'border-t': ['[&_:where(tfoot)]:border-t'],
        'font-medium': ['[&_:where(tfoot)]:font-medium'],
        '[&>tr]:last:border-b-0': [RULED],
      },
      HlmTr: {
        'hover:bg-muted/50': [
          '[@media(hover:hover)]:[&_:where(tr:hover:not([data-state=selected]))]:bg-accent',
        ],
        'data-[state=selected]:bg-muted': ['[&_:where(tr[data-state=selected])]:bg-accent'],
        'border-b': [RULED, '[&_:where(tr)]:border-border'],
        'transition-colors': ['[&_:where(tr)]:transition-colors'],
        'has-aria-expanded:bg-muted/50': [
          '[&_:where(tr:has([aria-expanded=true]):not([data-state=selected]))]:bg-accent',
        ],
      },
      HlmTh: {
        'text-foreground': ['[&_:where(th)]:text-foreground'],
        'h-10': ['[&_:where(th)]:h-10'],
        'px-2': ['[&_:where(th)]:px-2'],
        'text-start': [START],
        'align-middle': ['[&_:where(th,td)]:align-middle'],
        'font-medium': ['[&_:where(th)]:font-medium'],
        'whitespace-nowrap': ['[&_:where(thead_th)]:whitespace-nowrap'],
        '[&:has([role=checkbox])]:pe-0': [],
      },
      HlmTd: {
        'p-2': ['[&_:where(td)]:p-2'],
        'align-middle': ['[&_:where(th,td)]:align-middle'],
        // Body cells wrap.
        'whitespace-nowrap': [],
        '[&:has([role=checkbox])]:pe-0': [],
      },
      HlmCaption: {
        'text-muted-foreground': ['[&_:where(caption)]:text-muted-foreground'],
        'mt-4': ['[&_:where(caption)]:mt-4'],
        'text-sm': ['[&_:where(caption)]:text-sm'],
      },
    };
    for (const [directive, taken] of Object.entries(TAKEN)) {
      expect(classSet(Object.keys(taken)), directive).toEqual(
        classSet(helmHostClasses(helmTable, directive)),
      );
      for (const [helmClass, kitClasses] of Object.entries(taken)) {
        expect(classesOf(table), `${directive} ${helmClass}`).toEqual(
          expect.arrayContaining(kitClasses),
        );
      }
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
    /** The page, a card and a dialog's panel (`--popover`), which a table may stand on. */
    const UNDER = ['background', 'card', 'popover'] as const;
    /** Each fill by the child variant of the rule that sets it. */
    const FILLS = {
      'a selected row': '[&_:where(tr[data-state=selected])]',
      'a hovered row': '[&_:where(tr:hover:not([data-state=selected]))]',
      'a row with an expanded control':
        '[&_:where(tr:has([aria-expanded=true]):not([data-state=selected]))]',
      'the footer': '[&_:where(tfoot)]',
    };
    /** The color value of the `bg-` rule whose last variant is `selector`. */
    const fillOf = (classes: string[], selector: string) => {
      const fills = classes
        .map(splitVariants)
        .filter(
          ({ variants, utility }) => variants.at(-1) === selector && utility.startsWith('bg-'),
        );
      expect(fills, selector).toHaveLength(1);
      return fills[0].utility.slice('bg-'.length);
    };

    for (const scheme of SCHEMES) {
      it(`${scheme}: the selected, hovered, expanded and footer fills show on the page, a card and a dialog (${MIN_FILL_CONTRAST}:1)`, async () => {
        const { table } = await render();
        const tokens = spartanThemeTokens(scheme);
        for (const [fill, selector] of Object.entries(FILLS)) {
          const value = fillOf(classesOf(table), selector);
          for (const under of UNDER) {
            const color = resolveColor(value, tokens, tokens[under]);
            expect(
              contrastRatio(color, tokens[under]),
              `${fill} (${value}) on --${under}`,
            ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
          }
        }
      });
    }
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
