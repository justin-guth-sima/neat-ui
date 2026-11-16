import { TestBed } from '@angular/core/testing';
import { FilteringAList } from './1-filtering-a-list.example';
import { SmallInAToolbar } from './2-small-in-a-toolbar.example';

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const field = host.querySelector('neat-search input') as HTMLInputElement;
  const type = async (text: string) => {
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { host, field, type };
}

describe('the search examples', () => {
  it('filters the streams by name or source and says how many are left', async () => {
    const { host, type } = await render(FilteringAList);
    const names = () =>
      Array.from(host.querySelectorAll('li > span:first-child'), (span) => span.textContent);
    const status = () => host.querySelector('neat-search .status')?.textContent?.trim();

    expect(names()).toHaveLength(5);
    expect(status()).toBe('5 streams');

    await type('file');
    expect(names()).toEqual(['Parking lot', 'Yard']);
    expect(status()).toBe('2 streams');

    await type('lobby');
    expect(status()).toBe('1 stream');

    await type('garage');
    expect(names()).toEqual([]);
    expect(status()).toBe('Nothing matches');
  });

  it('puts a small field without a status line beside small buttons', async () => {
    const { host, field } = await render(SmallInAToolbar);

    expect(field.getAttribute('aria-label')).toBe('Filter files');
    expect(field.classList).toContain('h-8');
    expect(host.querySelector('neat-search .status')).toBeNull();
    expect(host.querySelectorAll('.tools button[neatButton]')).toHaveLength(2);
  });
});
