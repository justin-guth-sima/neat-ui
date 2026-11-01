import { TestBed } from '@angular/core/testing';
import { AlignedLists } from './2-aligned-lists.example';
import { SourceFacts } from './1-source-facts.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const pairs = (list: Element) =>
  Array.from(list.querySelectorAll('dt'), (term) => [
    term.textContent?.trim(),
    // The value's parts one by one: a code span and a button have no space between them in the DOM.
    Array.from(term.nextElementSibling?.childNodes ?? [], (node) => node.textContent?.trim())
      .filter(Boolean)
      .join(' '),
  ]);

describe('the details examples', () => {
  it('list the facts of a source, the URL with its Copy button', async () => {
    const host = await render(SourceFacts);

    expect(pairs(host.querySelector('dl')!)).toEqual([
      ['Source', 'rtsp://192.168.1.10:554/stream1'],
      ['Status', 'Pulling'],
      ['URL', 'rtsp://neat.local:8554/src3 Copy'],
      ['Live for', '1:02:41'],
      ['Bitrate', '4.2 Mbit/s'],
    ]);
    const url = Array.from(host.querySelectorAll('dd')).find((dd) =>
      dd.textContent?.includes('Copy'),
    );
    expect(url?.querySelector('button')?.textContent?.trim()).toBe('Copy');
  });

  it('set the term column on the lists common ancestor, which both lists inherit', async () => {
    const host = await render(AlignedLists);
    const lists = Array.from(host.querySelectorAll('dl'));
    const termWidth = (element: Element) =>
      getComputedStyle(element).getPropertyValue('--neat-details-term-width').trim();

    expect(lists).toHaveLength(2);
    expect(lists[0].parentElement).toBe(lists[1].parentElement);
    expect(termWidth(lists[0].parentElement!)).toBe('7rem');
    expect(lists.map(termWidth)).toEqual(['7rem', '7rem']);
    expect(lists.map((list) => pairs(list)[0][0])).toEqual(['Model', 'Receiver']);
  });
});
