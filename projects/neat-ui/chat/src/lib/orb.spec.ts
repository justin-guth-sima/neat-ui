import { TestBed } from '@angular/core/testing';
import { CHAT_CLOCK } from './chat-clock';
import { NeatChatOrb } from './orb';

/** A frame clock the spec steps: `frame(ms)` moves time on and runs the frames requested. */
function steppedFrames() {
  let now = 1000;
  let queued: (() => void)[] = [];
  return {
    now: () => now,
    request(callback: () => void) {
      queued.push(callback);
      return queued.length;
    },
    cancel() {
      queued = [];
    },
    frame(ms: number) {
      now += ms;
      const due = queued;
      queued = [];
      for (const callback of due) callback();
    },
    pending: () => queued.length > 0,
  };
}

describe('NeatChatOrb', () => {
  let clock: ReturnType<typeof steppedFrames>;

  beforeEach(() => {
    clock = steppedFrames();
    TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
  });

  const render = () => {
    const fixture = TestBed.createComponent(NeatChatOrb);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  };

  it('counts from its creation in hundredths', () => {
    const { element } = render();
    expect(element.querySelector('.seconds')!.textContent).toBe('0.00');
    clock.frame(420);
    expect(element.querySelector('.seconds')!.textContent).toBe('0.42');
    expect(element.querySelector('.clock')!.textContent).toContain('to the first word');
  });

  it('stops its frames when destroyed', () => {
    const { fixture } = render();
    expect(clock.pending()).toBe(true);
    fixture.destroy();
    expect(clock.pending()).toBe(false);
  });

  it('the orb and clock are hidden from assistive technology', () => {
    const { element } = render();
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.orb')).not.toBeNull();
  });
});
