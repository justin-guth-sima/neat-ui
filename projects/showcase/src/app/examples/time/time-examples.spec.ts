import { TestBed } from '@angular/core/testing';
import { Ages } from './1-ages.example';
import { Durations } from './2-durations.example';

describe('the time examples', () => {
  it('say each age in the words of neatSecondsAgo', async () => {
    const fixture = TestBed.createComponent(Ages);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const terms = Array.from(host.querySelectorAll('dt'), (dt) => dt.textContent?.trim());
    const words = Array.from(host.querySelectorAll('dd'), (dd) => dd.textContent?.trim());

    expect(Object.fromEntries(terms.map((term, index) => [term, words[index]]))).toEqual({
      '-5 s': 'just now',
      '0 s': 'just now',
      '9 s': 'just now',
      '10 s': '10 s ago',
      '59 s': '59 s ago',
      '60 s': '1 min ago',
      '3599 s': '59 min ago',
      '3600 s': '1 h ago',
      '86399 s': '23 h ago',
      '86400 s': '1 d ago',
      '259200 s': '3 d ago',
    });
  });

  it('say each length of time in the words of neatDuration', async () => {
    const fixture = TestBed.createComponent(Durations);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const terms = Array.from(host.querySelectorAll('dt'), (dt) => dt.textContent?.trim());
    const words = Array.from(host.querySelectorAll('dd'), (dd) => dd.textContent?.trim());

    expect(Object.fromEntries(terms.map((term, index) => [term, words[index]]))).toEqual({
      '0 s': '0 s',
      '59.9 s': '59 s',
      '60 s': '1 min 00 s',
      '307 s': '5 min 07 s',
      '3599 s': '59 min 59 s',
      '3600 s': '1 h 00 min',
      '7559 s': '2 h 05 min',
      '86399 s': '23 h 59 min',
      '86400 s': '1 d 00 h',
      '273540 s': '3 d 03 h',
      '-1 s': '–',
      null: '–',
    });
  });
});
