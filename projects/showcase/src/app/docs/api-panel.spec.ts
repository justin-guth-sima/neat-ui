import { TestBed } from '@angular/core/testing';
import { ApiPanel } from './api-panel';
import type { DocsTopicPart } from './docs-context';
import type { DocBlock } from './model';
import { FakeDocs, provideFakeDocs } from './docs.testing';

const words = (text: string): DocBlock[] => [
  { kind: 'paragraph', spans: [{ kind: 'text', text }] },
];
const SOURCE = 'projects/neat-ui/diagram/src/lib/model.ts';

const part = (name: string, entry = '@sima/neat-ui/diagram'): DocsTopicPart => ({
  part: { name, kind: 'type', definition: "'a'", doc: words(`About ${name}.`), source: SOURCE },
  import: entry,
});

describe('ApiPanel', () => {
  async function render(parts: readonly DocsTopicPart[], introduced = new Set<string>()) {
    const names = parts.map((item) => item.part.name);
    TestBed.configureTestingModule({ providers: provideFakeDocs(new FakeDocs(names)) });
    const fixture = TestBed.createComponent(ApiPanel);
    fixture.componentRef.setInput('parts', parts);
    fixture.componentRef.setInput('introduced', introduced);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('names the entry the parts come from and gives each its section, in order', async () => {
    const { host } = await render([part('NeatDiagramView'), part('NeatDiagramRole')]);

    expect(host.querySelector('h2')?.textContent).toBe('API');
    expect(host.querySelector('.title code')?.textContent).toBe('@sima/neat-ui/diagram');
    expect(Array.from(host.querySelectorAll('app-api-part'), (section) => section.id)).toEqual([
      'api-NeatDiagramView',
      'api-NeatDiagramRole',
    ]);
  });

  it('names no entry for a topic that spans entries', async () => {
    const { host } = await render([part('NeatTone', '@sima/neat-ui'), part('NeatStatusChip')]);

    expect(host.querySelector('.title code')).toBeNull();
  });

  it('leaves out the doc of a part the body introduces', async () => {
    const { host } = await render(
      [part('NeatDiagramView'), part('NeatDiagramRole')],
      new Set(['NeatDiagramView']),
    );

    expect(host.querySelector('#api-NeatDiagramView')?.textContent).not.toContain('About');
    expect(host.querySelector('#api-NeatDiagramRole')?.textContent).toContain(
      'About NeatDiagramRole.',
    );
  });

  it('links every part from the jump list, folding the links after the eighth', async () => {
    const parts = Array.from({ length: 11 }, (_, index) => part(`NeatPart${index}`));
    const { fixture, host } = await render(parts);
    const links = (): string[] =>
      Array.from(host.querySelectorAll('.jump a'), (link) => link.getAttribute('href') ?? '');
    const more = host.querySelector('.jump button') as HTMLButtonElement;

    expect(links()).toHaveLength(8);
    expect(links()[0]).toBe('/#api-NeatPart0');
    expect(more.textContent?.trim()).toBe('+ 3 more');
    expect(more.getAttribute('aria-expanded')).toBe('false');

    more.click();
    await fixture.whenStable();

    expect(links()).toHaveLength(11);
    expect(more.textContent?.trim()).toBe('Fewer');
  });

  it('folds nothing in a short jump list', async () => {
    const { host } = await render([part('NeatDiagramView')]);

    expect(host.querySelector('.jump button')).toBeNull();
  });
});
