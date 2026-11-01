import { TestBed } from '@angular/core/testing';
import { AcceptedFiles } from './1-accepted-files.example';

/** jsdom has no DataTransfer, so a drag event carries the part the zone reads. */
function drop(zone: HTMLElement, files: File[]): void {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files, types: ['Files'], dropEffect: 'none' },
  });
  zone.dispatchEvent(event);
}

describe('the drop zone examples', () => {
  async function render() {
    const fixture = TestBed.createComponent(AcceptedFiles);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const zones = Array.from(host.querySelectorAll<HTMLButtonElement>('neat-drop-zone button'));
    const log = () =>
      host.querySelector('.showcase-code')?.textContent?.replace(/\s+/g, ' ').trim();
    return { fixture, zones, log };
  }

  it('start with an empty log and a disabled third zone', async () => {
    const { zones, log } = await render();

    expect(log()).toBe('Nothing dropped yet');
    expect(zones.map((zone) => zone.disabled)).toEqual([false, false, true]);
  });

  it('turn a text file away from the video zone and take a video', async () => {
    const { fixture, zones, log } = await render();

    drop(zones[0], [new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    await fixture.whenStable();
    expect(log()).toBe('Not accepted: notes.txt');

    drop(zones[0], [new File(['x'], 'clip.mp4', { type: 'video/mp4' })]);
    await fixture.whenStable();
    expect(log()).toBe('Received: clip.mp4 Not accepted: notes.txt');
  });

  it('take several files of any kind in the second zone, newest first', async () => {
    const { fixture, zones, log } = await render();

    drop(zones[1], [
      new File(['x'], 'a.txt', { type: 'text/plain' }),
      new File(['y'], 'b.png', { type: 'image/png' }),
    ]);
    await fixture.whenStable();

    expect(log()).toBe('Received: a.txt, b.png');
  });
});
