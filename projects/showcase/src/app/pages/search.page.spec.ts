import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import { DocsSearch } from '../search/docs-search';
import { SearchPage } from './search.page';

async function open(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'search', component: SearchPage },
        { path: '**', children: [] },
      ]),
      { provide: NeatViewport, useValue: { narrow: signal(false) } },
    ],
  });
  await TestBed.inject(DocsSearch).load();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, SearchPage);
  await harness.fixture.whenStable();
  const host = harness.routeNativeElement as HTMLElement;
  return { harness, host, settle: () => harness.fixture.whenStable() };
}

describe('SearchPage', () => {
  it('lists every result of the address’s search, in groups with their counts', async () => {
    const { host } = await open('/search?q=search');
    const headings = Array.from(host.querySelectorAll('h2'), (h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(headings[0]).toMatch(/^Topics \d+$/);
    expect(headings.map((h) => h?.split(' ')[0])).toEqual(['Topics', 'API', 'Members', 'Examples']);
    expect((host.querySelector('neat-search input') as HTMLInputElement).value).toBe('search');
    expect(host.querySelector('neat-search .status')?.textContent?.trim()).toMatch(/^\d+ results$/);
  });

  it('links each result to its place, with its first sentence', async () => {
    const { host } = await open('/search?q=NeatSearch');
    const link = Array.from(host.querySelectorAll('a')).find(
      (a) => a.querySelector('.label')?.textContent === 'NeatSearch',
    )!;

    expect(link.getAttribute('href')).toBe('/components/forms/search#api-NeatSearch');
    expect(link.parentElement?.querySelector('p')?.textContent).toBe(
      'A search field, for filtering what a page shows.',
    );
  });

  it('puts what is typed in the address, in place of the search before', async () => {
    const { host, settle } = await open('/search?q=slider');
    const field = host.querySelector('neat-search input') as HTMLInputElement;

    field.value = 'select';
    field.dispatchEvent(new Event('input'));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/search?q=select');
  });

  it('shows nothing, and no count, without a search', async () => {
    const { host } = await open('/search');

    expect(host.querySelectorAll('section')).toHaveLength(0);
    expect(host.querySelector('neat-search .status')?.textContent?.trim()).toBe('');
  });
});
