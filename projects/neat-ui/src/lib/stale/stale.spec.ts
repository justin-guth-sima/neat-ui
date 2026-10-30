import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatStale } from './stale';

@Component({
  imports: [NeatStale],
  template: `<span class="host-class" [neatStale]="stale()">12.4 fps</span>`,
})
class StaleHost {
  readonly stale = signal(true);
}

async function render() {
  const fixture = TestBed.createComponent(StaleHost);
  await fixture.whenStable();
  const value = (fixture.nativeElement as HTMLElement).querySelector('span') as HTMLElement;
  return { fixture, host: fixture.componentInstance, value };
}

describe('NeatStale', () => {
  it('fades and greys its host while what it shows is stale', async () => {
    const { value } = await render();

    // jsdom applies no Tailwind: the look is its classes, stated once on the directive.
    expect([...value.classList]).toEqual(expect.arrayContaining(['opacity-55', 'grayscale']));
  });

  it('shows its host as it is once fresh again, with no transition between the two', async () => {
    const { fixture, host, value } = await render();

    host.stale.set(false);
    await fixture.whenStable();

    expect([...value.classList]).toEqual(['host-class']);
    host.stale.set(true);
    await fixture.whenStable();
    expect([...value.classList].some((name) => name.startsWith('transition'))).toBe(false);
  });

  it('keeps classes the app sets alongside its own', async () => {
    const { value } = await render();

    expect([...value.classList]).toEqual(expect.arrayContaining(['host-class', 'opacity-55']));
  });
});
