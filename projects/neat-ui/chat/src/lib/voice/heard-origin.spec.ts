import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { steppedFrames } from '../chat.testing';
import { CHAT_CLOCK } from '../chat-clock';
import { HEARD_ORIGIN_MS, HeardOrigin } from './heard-origin';

describe('HeardOrigin', () => {
  it('gives the element once, within 15 s', () => {
    const clock = steppedFrames();
    TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
    const origin = TestBed.inject(HeardOrigin);
    const area = document.createElement('textarea');
    expect(origin.take()).toBeNull();
    origin.note(area);
    expect(origin.take()).toBe(area);
    expect(origin.take()).toBeNull();
    origin.note(area);
    clock.frame(HEARD_ORIGIN_MS);
    expect(origin.take()).toBe(area);
    origin.note(area);
    clock.frame(HEARD_ORIGIN_MS + 1);
    expect(origin.take()).toBeNull();
    expect(HEARD_ORIGIN_MS).toBe(15_000);
  });
});
