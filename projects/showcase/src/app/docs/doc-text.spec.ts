import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CodeBox } from './code-box';
import { DocText } from './doc-text';
import type { DocBlock } from './model';
import { PartRef } from './part-ref';
import { FakeDocs, provideFakeDocs } from './docs.testing';
import { TypeText } from './type-text';

async function render<T>(component: new () => T, inputs: Record<string, unknown>, docs: FakeDocs) {
  TestBed.configureTestingModule({ providers: provideFakeDocs(docs) });
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PartRef', () => {
  it('links a part of the page to its section, which the page reveals as the URL changes', async () => {
    const docs = new FakeDocs(['NeatDiagramView']);
    const host = await render(PartRef, { name: 'NeatDiagramView' }, docs);
    const link = host.querySelector('a') as HTMLAnchorElement;

    expect(link.textContent).toBe('NeatDiagramView');
    expect(link.getAttribute('href')).toBe('/#api-NeatDiagramView');

    link.click();

    // The fragment the click writes reveals the part, so the link does not as well.
    expect(docs.revealed).toEqual([]);
  });

  it('reveals the part itself when the URL already has its fragment, which the router ignores', async () => {
    const docs = new FakeDocs(['NeatDiagramView']);
    TestBed.configureTestingModule({ providers: provideFakeDocs(docs) });
    await TestBed.inject(Router).navigateByUrl('/#api-NeatDiagramView');
    const fixture = TestBed.createComponent(PartRef);
    fixture.componentRef.setInput('name', 'NeatDiagramView');
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('a') as HTMLAnchorElement).click();

    expect(docs.revealed).toEqual(['NeatDiagramView']);
  });

  it("links a part of another page to that topic's section", async () => {
    const docs = new FakeDocs([], { NeatTone: '/theme/colors' });
    const host = await render(PartRef, { name: 'NeatTone', label: 'tones' }, docs);
    const link = host.querySelector('a') as HTMLAnchorElement;

    expect(link.textContent).toBe('tones');
    expect(link.getAttribute('href')).toBe('/theme/colors#api-NeatTone');

    link.click();

    expect(docs.revealed).toEqual([]);
  });

  it('leaves a name no topic documents as text, not a link', async () => {
    const host = await render(PartRef, { name: 'NeatUnknown' }, new FakeDocs());

    expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(host.textContent).toBe('NeatUnknown');
  });
});

describe('TypeText', () => {
  it('spells the type again, its documented names as links', async () => {
    const text = 'Readonly<Record<string, NeatDiagram>> | NeatTone[]';
    const docs = new FakeDocs(['NeatDiagram'], { NeatTone: '/theme/colors' });
    const host = await render(TypeText, { text }, docs);

    expect(host.textContent).toBe(text);
    expect(Array.from(host.querySelectorAll('a[href]'), (a) => a.textContent)).toEqual([
      'NeatDiagram',
      'NeatTone',
    ]);
  });
});

describe('CodeBox', () => {
  it('shows code as written, its lines and indents kept', async () => {
    const code = '<neat-diagram [diagram]="set">\n  <ng-template neatDiagramBlock let-node>';
    const host = await render(CodeBox, { code }, new FakeDocs(['NeatDiagram']));

    expect(host.querySelector('pre')?.textContent).toBe(code);
    expect(host.querySelector('a')).toBeNull();
  });

  it('links the documented names of a signature when asked to', async () => {
    const code = 'neatDrillDownLevel(diagram: NeatDiagram, blockId: string): NeatDiagram';
    const host = await render(CodeBox, { code, linked: true }, new FakeDocs(['NeatDiagram']));

    expect(host.querySelector('pre')?.textContent).toBe(code);
    expect(host.querySelectorAll('pre a[href]')).toHaveLength(2);
  });
});

describe('DocText', () => {
  const blocks: DocBlock[] = [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'Shows ' },
        { kind: 'code', text: 'level' },
        { kind: 'text', text: ', fed by ' },
        { kind: 'ref', text: 'NeatDiagramSet.levels', name: 'NeatDiagramSet', member: 'levels' },
        { kind: 'text', text: '; ' },
        { kind: 'text', text: 'never', strong: true },
        { kind: 'text', text: ' empty.' },
      ],
    },
    { kind: 'code', language: 'html', code: '@if (node.id === "a") {\n  <b>A</b>\n}' },
    {
      kind: 'list',
      items: [[{ kind: 'text', text: 'one' }], [{ kind: 'code', text: 'two', strong: true }]],
    },
  ];

  it('renders paragraphs, code and lists, and spells their text exactly', async () => {
    const host = await render(DocText, { blocks }, new FakeDocs(['NeatDiagramSet']));

    const paragraph = host.querySelector('p') as HTMLElement;
    expect(paragraph.textContent).toBe('Shows level, fed by NeatDiagramSet.levels; never empty.');
    expect(paragraph.querySelector('strong')?.textContent).toBe('never');
    expect(Array.from(paragraph.querySelectorAll('code'), (c) => c.textContent)).toEqual([
      'level',
      'NeatDiagramSet.levels',
    ]);
    expect(host.querySelector('pre')?.textContent).toBe('@if (node.id === "a") {\n  <b>A</b>\n}');
    expect(Array.from(host.querySelectorAll('li'), (li) => li.textContent)).toEqual(['one', 'two']);
    expect(host.querySelector('li strong code')?.textContent).toBe('two');
  });

  it('links a reference to its part, member and all', async () => {
    const host = await render(DocText, { blocks }, new FakeDocs(['NeatDiagramSet']));
    const link = host.querySelector('p a') as HTMLAnchorElement;

    expect(link.textContent).toBe('NeatDiagramSet.levels');
    expect(link.getAttribute('href')).toBe('/#api-NeatDiagramSet');
  });
});
