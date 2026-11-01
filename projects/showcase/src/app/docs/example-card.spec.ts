import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExampleCard } from './example-card';
import type { DocsExample } from './model';
import { FakeDocs, provideFakeDocs } from './docs.testing';

@Component({ selector: 'app-tones', template: '<p class="live-tones">Six tones</p>' })
class Tones {}

const EXAMPLE: DocsExample = {
  id: 'tones',
  title: 'Tones',
  component: Tones,
  caption: [{ kind: 'paragraph', spans: [{ kind: 'text', text: 'The six tones, in words.' }] }],
  shows: ['@sima/neat-ui#NeatTone', '@sima/neat-ui/status-chip#NeatStatusChip'],
  files: [{ name: 'tones.example.ts', code: [['text', 'export class Tones {}\n']] }],
};

describe('ExampleCard', () => {
  async function render(docs: FakeDocs) {
    TestBed.configureTestingModule({ providers: provideFakeDocs(docs) });
    const fixture = TestBed.createComponent(ExampleCard);
    fixture.componentRef.setInput('example', EXAMPLE);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('titles the example, captions it and renders it live', async () => {
    const host = await render(new FakeDocs(['NeatStatusChip']));
    const card = host.querySelector('article') as HTMLElement;

    expect(card.querySelector('h3')?.textContent?.trim()).toBe('Tones');
    expect(card.getAttribute('aria-labelledby')).toBe(card.querySelector('h3')?.id);
    expect(card.textContent).toContain('The six tones, in words.');
    expect(card.querySelector('.live .live-tones')?.textContent).toBe('Six tones');
    expect(card.querySelector('app-snippet')).not.toBeNull();
  });

  it('links the parts it shows, wherever each is documented', async () => {
    const host = await render(new FakeDocs(['NeatStatusChip'], { NeatTone: '/theme/colours' }));
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.shows a'));

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['NeatTone', '/theme/colours#api-NeatTone'],
      ['NeatStatusChip', '/#api-NeatStatusChip'],
    ]);
  });
});
