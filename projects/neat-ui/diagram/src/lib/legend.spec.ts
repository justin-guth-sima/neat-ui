import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import diagramStyles from './diagram.css' with { loader: 'text' };
import { NeatDiagramLegend, type NeatDiagramLegendItem } from './legend';
import legendStyles from './legend.css' with { loader: 'text' };
import lineStyles from './lines.css' with { loader: 'text' };
import { resetReported } from './report';

@Component({
  imports: [NeatDiagramLegend],
  template: `<neat-diagram-legend [items]="items()" />`,
})
class LegendHost {
  readonly items = signal<readonly NeatDiagramLegendItem[]>([
    { series: 1, label: 'image' },
    { series: 4, line: 'dashed', label: 'results' },
    { line: 'ghost', series: 2, label: 'not run here' },
    { line: 'solid', label: 'control' },
  ]);
}

async function render() {
  const fixture = TestBed.createComponent(LegendHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const items = () => Array.from(root.querySelectorAll<HTMLElement>('li'));
  return { fixture, host: fixture.componentInstance, root, items };
}

afterEach(() => resetReported());

describe('NeatDiagramLegend', () => {
  it('lists each item by its label in a list named Legend', async () => {
    const { root, items } = await render();
    expect(root.querySelector('ul')?.getAttribute('aria-label')).toBe('Legend');
    expect(items().map((item) => item.textContent?.trim())).toEqual([
      'image',
      'results',
      'not run here',
      'control',
    ]);
  });

  it('shows a series without a line as its swatch, in the colour its edges take', async () => {
    const { items } = await render();
    const [image] = items();
    const swatch = image.querySelector('.swatch');
    expect(swatch?.getAttribute('aria-hidden')).toBe('true');
    expect(image.querySelector('svg')).toBeNull();
    expect(image.style.getPropertyValue('--edge')).toBe('var(--neat-series-1)');
  });

  it('shows a line as a sample of it, muted where its edges are (a ghost, no series)', async () => {
    const { items } = await render();
    const [, results, ghost, control] = items();
    const sample = (item: HTMLElement) => item.querySelector('svg');
    expect(sample(results)?.dataset['line']).toBe('dashed');
    expect(sample(results)?.getAttribute('aria-hidden')).toBe('true');
    expect(sample(results)?.querySelector('line.line')).not.toBeNull();
    expect(results.querySelector('.swatch')).toBeNull();
    expect(results.style.getPropertyValue('--edge')).toBe('var(--neat-series-4)');
    expect(sample(ghost)?.dataset['line']).toBe('ghost');
    expect(ghost.style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
    expect(sample(control)?.dataset['line']).toBe('solid');
    expect(control.style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
  });

  it('draws a series outside 1 to 8 muted and names it once, as an edge with it would be', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { fixture, host, items } = await render();
      host.items.set([{ series: 9, label: 'ninth' }]);
      await fixture.whenStable();
      host.items.set([{ series: 9, label: 'ninth' }]);
      await fixture.whenStable();
      expect(items()[0].style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
      const messages = error.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('"ninth"'))).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });

  it('takes its line looks from the rules the edges use, stated once', () => {
    for (const look of ['solid', 'dashed', 'ghost']) {
      expect(lineStyles).toContain(`[data-line='${look}']`);
      expect(diagramStyles).not.toContain(`[data-line='${look}']`);
      expect(legendStyles).not.toContain(`[data-line='${look}']`);
    }
  });
});
