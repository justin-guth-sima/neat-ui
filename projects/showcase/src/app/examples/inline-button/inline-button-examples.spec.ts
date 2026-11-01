import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InALine } from './1-in-a-line.example';

describe('the inline button examples', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('set an action into a note and into the lines of a list, one disabled and one a link', async () => {
    const fixture = TestBed.createComponent(InALine);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const actions = Array.from(host.querySelectorAll<HTMLElement>('[data-slot="button"]'));

    expect(actions.map((action) => action.textContent?.trim())).toEqual([
      'Show',
      'Use global',
      'Use global',
      'Reset on 2 channels…',
      'This page',
    ]);
    expect(host.querySelector('p')?.contains(actions[0])).toBe(true);
    expect(host.querySelector('ul')?.contains(actions[1])).toBe(true);
    expect((actions[3] as HTMLButtonElement).disabled).toBe(true);
    expect(actions[4].getAttribute('href')).toBe('/actions/inline-button');
  });
});
