import { TestBed } from '@angular/core/testing';
import { HiddenTiles } from './1-hidden-tiles.example';

describe('the empty state examples', () => {
  it('shows the empty state while every tile is hidden, and the tiles once they are shown', async () => {
    const fixture = TestBed.createComponent(HiddenTiles);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const button = (name: string) =>
      Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);

    expect(host.querySelector('neat-empty')).not.toBeNull();
    expect(host.querySelectorAll('.tile').length).toBe(0);

    button('Show all tiles')!.click();
    await fixture.whenStable();
    expect(host.querySelector('neat-empty')).toBeNull();
    expect(host.querySelectorAll('.tile').length).toBe(4);

    button('Hide all tiles')!.click();
    await fixture.whenStable();
    expect(host.querySelector('neat-empty')).not.toBeNull();
  });
});
