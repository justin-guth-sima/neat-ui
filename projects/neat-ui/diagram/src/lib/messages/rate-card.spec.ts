import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { NeatDiagramEdgeRate } from './messages';
import { NeatDiagramRateCard } from './rate-card';

@Component({
  imports: [NeatDiagramRateCard],
  template: `
    <neat-diagram-rate-card label="Tracker → Gateway" [rate]="rate()" [stageMs]="stageMs()"
      [showBytes]="showBytes()"
    >
      <img neatRateCardThumbnails alt="" src="data:," />
    </neat-diagram-rate-card>
  `,
})
class Host {
  readonly rate = signal<NeatDiagramEdgeRate>({ msgsPerSec: 0, bytesPerSec: 0, history: [] });
  readonly stageMs = signal<number | undefined>(undefined);
  readonly showBytes = signal(true);
}

describe('NeatDiagramRateCard', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const card = () => root.querySelector('neat-diagram-rate-card') as HTMLElement;
    const text = (selector: string) => card().querySelector(selector)?.textContent?.trim();
    const set = (rate: Partial<NeatDiagramEdgeRate>, stageMs?: number) => {
      fixture.componentInstance.rate.set({
        msgsPerSec: 0,
        bytesPerSec: 0,
        history: [],
        ...rate,
      });
      fixture.componentInstance.stageMs.set(stageMs);
      fixture.detectChanges();
    };
    return { fixture, card, text, set };
  }

  it('names the card and reads zero before anything arrived', () => {
    const { text, card } = render();
    expect(text('.label')).toBe('Tracker → Gateway');
    const values = Array.from(card().querySelectorAll('.numbers .value'), (v) => v.textContent);
    expect(values).toEqual(['0', '0.00']);
    const units = Array.from(card().querySelectorAll('.numbers > span'), (u) => u.textContent);
    expect(units).toEqual(['0 msg/s', '0.00 MB/s']);
  });

  it('showBytes false leaves out the megabytes and keeps the messages and the history', () => {
    const { fixture, card, set } = render();
    set({ msgsPerSec: 29.6, bytesPerSec: 4_512_345, history: [1, 2, 3] });
    expect(card().textContent).toContain('MB/s');

    fixture.componentInstance.showBytes.set(false);
    fixture.detectChanges();

    expect(card().textContent).not.toContain('MB/s');
    const values = Array.from(card().querySelectorAll('.numbers .value'), (v) => v.textContent);
    expect(values).toEqual(['30']);
    expect(card().querySelector('neat-sparkline')).not.toBeNull();
  });

  it('showBytes does not change a step’s stage time', () => {
    const { fixture, text, set } = render();
    fixture.componentInstance.showBytes.set(false);
    set({ msgsPerSec: 5 }, 12.34);

    expect(text('.stage')).toBe('Stage 12.3 ms');
  });

  it('shows whole messages per second and megabytes with two decimals', () => {
    const { card, set } = render();
    set({ msgsPerSec: 29.6, bytesPerSec: 4_512_345 });
    const values = Array.from(card().querySelectorAll('.numbers .value'), (v) => v.textContent);
    expect(values).toEqual(['30', '4.51']);
  });

  it('rounds the bytes in units of 10 kB, as the demo does', () => {
    const { card, set } = render();
    const mb = () => card().querySelectorAll('.numbers .value')[1].textContent;
    set({ bytesPerSec: 4_999 });
    expect(mb()).toBe('0.00');
    set({ bytesPerSec: 5_000 });
    expect(mb()).toBe('0.01');
    set({ bytesPerSec: 12_000_000 });
    expect(mb()).toBe('12.00');
  });

  it('draws the history as a sparkline named for its messages per second, worded in msg/s', () => {
    const { card, set } = render();
    set({ history: [2, 8.4, 5] });
    const sparkline = card().querySelector('neat-sparkline') as HTMLElement;
    expect(sparkline.getAttribute('aria-label')).toBe(
      'Tracker → Gateway, messages per second: 3 recent samples, 2 msg/s to 8 msg/s',
    );
    expect(sparkline.querySelector('path')).not.toBeNull();
  });

  it('shows a stage time instead of the bytes and the sparkline, in milliseconds to a tenth', () => {
    const { card, text, set } = render();
    set({ msgsPerSec: 12, history: [1, 2, 3] }, 2);
    expect(text('.stage')?.replace(/\s+/g, ' ')).toBe('Stage 2.0 ms');
    expect(text('.stage .value')).toBe('2.0');
    expect(card().querySelectorAll('.numbers .value')).toHaveLength(1);
    expect(card().querySelector('neat-sparkline')).toBeNull();
    expect(card().classList.contains('timed')).toBe(true);
    set({ msgsPerSec: 12 }, 6.44);
    expect(text('.stage .value')).toBe('6.4');
  });

  it('ignores a stage time that is not a number or below zero', () => {
    const { card, set } = render();
    set({}, Number.NaN);
    expect(card().querySelector('.stage')).toBeNull();
    expect(card().querySelector('neat-sparkline')).not.toBeNull();
    set({}, -1);
    expect(card().querySelector('.stage')).toBeNull();
  });

  it('projects the thumbnails between the label and the numbers', () => {
    const { card } = render();
    const parts = Array.from(card().children, (child) => child.className || child.tagName);
    expect(parts.slice(0, 3)).toEqual(['label', 'IMG', 'numbers']);
  });
});
