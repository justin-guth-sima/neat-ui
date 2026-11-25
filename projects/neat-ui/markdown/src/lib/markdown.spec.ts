import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatMarkdown } from './markdown';

@Component({
  imports: [NeatMarkdown],
  template: `<neat-markdown
    [text]="text()"
    [streaming]="streaming()"
    [headingOffset]="headingOffset()"
  />`,
})
class Host {
  readonly text = signal('');
  readonly streaming = signal(false);
  readonly headingOffset = signal(2);
}

function render(text: string, options: { streaming?: boolean; headingOffset?: number } = {}) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.text.set(text);
  fixture.componentInstance.streaming.set(options.streaming ?? false);
  if (options.headingOffset !== undefined) {
    fixture.componentInstance.headingOffset.set(options.headingOffset);
  }
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
  return { fixture, element };
}

describe('NeatMarkdown', () => {
  it('is prose', () => {
    expect(render('Hello').element.classList).toContain('neat-prose');
  });

  it('renders headings, lists, quotes and rules as elements', () => {
    const { element } = render(
      '# Title\n\nA *b* **c** ~~d~~ `e`\n\n- one\n- two\n  1. nested\n\n> quoted\n\n---\n\n3. three',
    );
    expect(element.querySelector('h3')?.textContent).toBe('Title');
    const paragraph = element.querySelector(':scope > p')!;
    expect(paragraph.querySelector('em')?.textContent).toBe('b');
    expect(paragraph.querySelector('strong')?.textContent).toBe('c');
    expect(paragraph.querySelector('del')?.textContent).toBe('d');
    expect(paragraph.querySelector('code')?.textContent).toBe('e');
    const items = element.querySelectorAll(':scope > ul > li');
    expect(items).toHaveLength(2);
    expect(items[1].querySelector(':scope > ol > li')?.textContent).toBe('nested');
    expect(element.querySelector(':scope > blockquote > p')?.textContent).toBe('quoted');
    expect(element.querySelector(':scope > hr')).not.toBeNull();
    expect(element.querySelector(':scope > ol')?.getAttribute('start')).toBe('3');
  });

  it('shows task items with their state in words a reader sees', () => {
    const { element } = render('- [x] done\n- [ ] todo');
    const items = [...element.querySelectorAll('li')].map((li) => li.textContent?.trim());
    expect(items).toEqual(['☑ done', '☐ todo']);
  });

  it('renders fenced code as neat-code-block with its language', () => {
    const { element } = render('```python\nprint(1)\n```\n\n```\nplain\n```');
    const blocks = element.querySelectorAll(':scope > neat-code-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].textContent).toContain('print(1)');
    expect(blocks[1].textContent).toContain('plain');
  });

  it('renders a table with neatTable', () => {
    const { element } = render('| a | b |\n|---|--:|\n| 1 | **2** |');
    const table = element.querySelector(':scope > table')!;
    expect(table.getAttribute('neattable')).not.toBeNull();
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['a', 'b']);
    const cells = table.querySelectorAll('tbody td');
    expect(cells[1].querySelector('strong')?.textContent).toBe('2');
    expect(cells[1].getAttribute('data-numeric')).not.toBeNull();
  });

  it('renders raw HTML as text', () => {
    const { element } = render(
      '<img src=x onerror=alert(1)> and <b>x</b>\n\n<script>alert(1)</script>',
    );
    expect(element.querySelector('img, script, b')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });

  it('links only http and https', () => {
    const { element } = render(
      '[a](javascript:alert(1)) [b](https://sima.ai) [c](data:text/html,x) [d](/relative)',
    );
    const links = [...element.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://sima.ai/']);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
    expect(element.textContent).toContain('a');
    expect(element.textContent).toContain('d');
  });

  it('shows an image as its alt text', () => {
    const { element } = render('See ![a shelf](http://example.com/shelf.png).');
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('[a shelf]');
  });

  it('while streaming, an unclosed bold already renders bold', () => {
    const { element } = render('Some **bo', { streaming: true });
    expect(element.querySelector('strong')?.textContent).toBe('bo');
  });

  it('while streaming, an open fence is already a code block', () => {
    const { element } = render('```js\nlet a', { streaming: true });
    expect(element.querySelector('neat-code-block')?.textContent).toContain('let a');
  });

  it("a finished block's element is kept as the text grows", () => {
    const { fixture, element } = render('First paragraph.\n\nSecond', { streaming: true });
    const first = element.querySelector('p');
    for (let i = 0; i < 20; i++) {
      fixture.componentInstance.text.update((text) => `${text} more`);
      fixture.detectChanges();
    }
    expect(element.querySelector('p')).toBe(first);
    expect(element.querySelectorAll('p')[1].textContent).toContain('more');
  });

  it('headingOffset shifts headings and caps at h6', () => {
    const { element } = render('# One\n\n#### Four', { headingOffset: 1 });
    expect(element.querySelector('h2')?.textContent).toBe('One');
    expect(element.querySelector('h5')?.textContent).toBe('Four');
    const capped = render('##### Five', { headingOffset: 3 }).element;
    expect(capped.querySelector('h6')?.textContent).toBe('Five');
  });

  it("a table's header row streams as a paragraph and becomes a table once its separator arrives", () => {
    const { fixture, element } = render('| a | b |\n', { streaming: true });
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('p')?.textContent).toContain('| a | b |');
    fixture.componentInstance.text.set('| a | b |\n|---|---|\n| 1 | 2 |');
    fixture.detectChanges();
    expect(element.querySelector('table')).not.toBeNull();
  });

  it('adds no space between runs that touch', () => {
    const { element } = render('a**b**`c`[d](https://sima.ai)e');
    expect(element.querySelector('p')?.textContent).toBe('abcde');
  });

  it('a line break is a br, and an escaped mark is its character', () => {
    const { element } = render('a  \nb \\*');
    expect(element.querySelector('p br')).not.toBeNull();
    expect(element.querySelector('p')?.textContent).toBe('ab *');
  });
});
