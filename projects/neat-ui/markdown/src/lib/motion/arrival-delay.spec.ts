import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ArrivalDelay } from './arrival-delay';
import { MOTION_CLOCK } from './motion-clock';

@Component({
  imports: [ArrivalDelay],
  template: `<span [neatArrivalAt]="at()"></span>`,
})
class Host {
  readonly at = signal<number | null>(100);
}

describe('ArrivalDelay', () => {
  let now = 250;

  beforeEach(() => {
    now = 250;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MOTION_CLOCK,
          useValue: { now: () => now, request: () => 0, cancel: () => undefined },
        },
      ],
    });
  });

  const render = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, span: fixture.nativeElement.querySelector('span') as HTMLElement };
  };

  it('sets a negative delay for a piece created after its arrival', () => {
    expect(render().span.style.animationDelay).toBe('-150ms');
  });

  it('sets it once', () => {
    const { fixture, span } = render();
    now = 400;
    fixture.componentInstance.at.set(300);
    fixture.detectChanges();
    expect(span.style.animationDelay).toBe('-150ms');
  });

  it('sets nothing for a letter shown before', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.at.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').style.animationDelay).toBe('');
  });
});
