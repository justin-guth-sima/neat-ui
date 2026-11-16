import { TestBed } from '@angular/core/testing';
import { SEARCH_INDEX } from '../docs/generated/search-index';
import { GROUPS } from '../docs/topics';
import { DocsSearch, indexCandidates } from './docs-search';

const labels = (search: DocsSearch, query: string, group: string) =>
  search
    .hits(query)
    .find((found) => found.label === group)
    ?.hits.map((hit) => hit.item.label) ?? [];

describe('the docs search', () => {
  it('finds nothing for an empty search', () => {
    expect(TestBed.inject(DocsSearch).hits('  ')).toEqual([]);
  });

  it('finds the topics and guides at once, before the index has loaded', () => {
    const search = TestBed.inject(DocsSearch);

    const groups = search.hits('slider');
    expect(groups.map((group) => group.label)).toEqual(['Topics']);
    expect(groups[0].hits[0].item).toEqual({
      id: 'topics:slider',
      label: 'Slider',
      detail: 'Components › Forms',
      icon: 'document',
      path: '/components/forms/slider',
    });
    expect(labels(search, 'getting', 'Topics')).toEqual(['Getting started']);
  });

  it('finds the parts, their members and the examples once the index has loaded', async () => {
    const search = TestBed.inject(DocsSearch);
    await search.load();

    const api = search.hits('NeatSlider').find((group) => group.label === 'API')!.hits[0];
    expect(api.item.path).toBe('/components/forms/slider#api-NeatSlider');
    expect(api.item.detail).toBe('component · Slider');
    expect(api.text.length).toBeGreaterThan(0);

    expect(labels(search, 'describedby', 'Members')).toContain('NeatSlider.describedBy');
    const example = search.hits('looks and sizes').find((group) => group.label === 'Examples')!
      .hits[0];
    expect(example.item.label).toBe('Looks and sizes');
    expect(example.item.path).toBe('/components/forms/search#example-looks-and-sizes');
  });

  it('places every part of the index on its topic’s page', () => {
    const placed = indexCandidates(SEARCH_INDEX, GROUPS);
    const parts = SEARCH_INDEX.filter((entry) => entry.kind === 'part');

    expect(placed.api).toHaveLength(parts.length);
    expect(placed.examples).toHaveLength(SEARCH_INDEX.filter((e) => e.kind === 'example').length);
  });

  it('gives the palette the same matches as its groups', async () => {
    const search = TestBed.inject(DocsSearch);
    await search.load();

    const groups = search.palette('search');
    expect(groups.map((group) => group.label)).toEqual(['Topics', 'API', 'Members', 'Examples']);
    expect(groups[0].items[0].label).toBe('Search');
    expect(groups[1].items[0].label).toBe('NeatSearch');
  });
});
