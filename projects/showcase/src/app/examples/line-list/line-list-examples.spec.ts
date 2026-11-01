import { TestBed } from '@angular/core/testing';
import { Regions } from './1-regions.example';

describe('the line list example', () => {
  it('delete a region from its line, and restore them once none are left', async () => {
    const fixture = TestBed.createComponent(Regions);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const regions = () => Array.from(host.querySelectorAll('li span'), (s) => s.textContent);
    const named = (name: string) =>
      host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    const restore = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Restore regions',
    )!;

    expect(regions()).toEqual(['Inclusion 1', 'Exclusion 1', 'Exclusion 2']);

    named('Delete Exclusion 1').click();
    await fixture.whenStable();
    expect(regions()).toEqual(['Inclusion 1', 'Exclusion 2']);

    named('Delete Inclusion 1').click();
    named('Delete Exclusion 2').click();
    await fixture.whenStable();
    expect(host.querySelector('ul')).toBeNull();
    expect(host.querySelector('p')?.textContent?.trim()).toBe('No regions.');

    restore.click();
    await fixture.whenStable();
    expect(regions()).toEqual(['Inclusion 1', 'Exclusion 1', 'Exclusion 2']);
  });
});
