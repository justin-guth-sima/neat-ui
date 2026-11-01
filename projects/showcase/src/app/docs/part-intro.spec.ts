import { TestBed } from '@angular/core/testing';
import type { DocBlock, DocsDeclaredPart } from './model';
import { PartIntro } from './part-intro';
import { FakeDocs, provideFakeDocs } from './docs.testing';

const words = (text: string): DocBlock => ({ kind: 'paragraph', spans: [{ kind: 'text', text }] });

const VIEW: DocsDeclaredPart = {
  name: 'NeatDiagramView',
  kind: 'component',
  selector: 'neat-diagram',
  doc: [
    words('A hand-placed diagram.'),
    { kind: 'code', language: 'html', code: '<neat-diagram />' },
    words('The host is a figure.'),
    words('Levels open by blocks.'),
    words('Pan and zoom.'),
  ],
  source: 'projects/neat-ui/diagram/src/lib/diagram.ts',
};

describe('PartIntro', () => {
  async function render(part: DocsDeclaredPart) {
    TestBed.configureTestingModule({ providers: provideFakeDocs(new FakeDocs()) });
    const fixture = TestBed.createComponent(PartIntro);
    fixture.componentRef.setInput('part', part);
    fixture.componentRef.setInput('import', '@sima/neat-ui/diagram');
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('names the part, its kind and how it is used, with the line that imports it', async () => {
    const { host } = await render(VIEW);

    expect(host.querySelector('h2')?.textContent?.trim()).toBe('NeatDiagramView');
    expect(host.querySelector('neat-status-chip')?.textContent?.trim()).toBe('component');
    expect(host.querySelector('.usage')?.textContent).toBe('<neat-diagram>');
    expect(host.querySelector('.import code')?.textContent).toBe(
      "import { NeatDiagramView } from '@sima/neat-ui/diagram';",
    );
    expect(host.querySelector('.import app-copy-button button')?.getAttribute('aria-label')).toBe(
      'Copy import line',
    );
  });

  it('shows the description up to its second paragraph, and the rest on request', async () => {
    const { fixture, host } = await render(VIEW);
    const more = host.querySelector('button[neatInlineButton]') as HTMLButtonElement;

    expect(host.querySelectorAll('app-doc-text p')).toHaveLength(2);
    expect(host.querySelector('app-doc-text pre')?.textContent).toBe('<neat-diagram />');
    expect(more.textContent?.trim()).toBe('Show the whole description');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-controls')).toBe(host.querySelector('app-doc-text')?.id);

    more.click();
    await fixture.whenStable();

    expect(host.querySelectorAll('app-doc-text p')).toHaveLength(4);
    expect(more.textContent?.trim()).toBe('Show less');
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('offers no more for a short description', async () => {
    const { host } = await render({ ...VIEW, doc: [words('Short.')] });

    expect(host.querySelector('button[neatInlineButton]')).toBeNull();
  });

  it('strikes a deprecated part through and says what to use instead', async () => {
    const { host } = await render({ ...VIEW, deprecated: [words('Use NeatOther.')] });

    expect(host.querySelector('h2 s')?.textContent).toBe('NeatDiagramView');
    expect(host.querySelector('neat-callout')?.textContent).toContain('Use NeatOther.');
  });
});
