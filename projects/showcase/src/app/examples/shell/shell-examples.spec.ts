import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { KIOSK_POINTER_IDLE_MS, KioskService } from '@sima/neat-ui';
import { NeatToasts } from '@sima/neat-ui/toast';
import { Kiosk } from './1-kiosk.example';
import { RailItems } from './2-rail-items.example';

describe('the shell examples', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enter and leave kiosk mode from one button that says which', async () => {
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [toggle] = Array.from(host.querySelectorAll('button'));
    expect(toggle.textContent?.trim()).toBe('Enter kiosk mode');

    toggle.click();
    await fixture.whenStable();

    expect(kiosk.active()).toBe(true);
    expect(toggle.textContent?.trim()).toBe('Leave kiosk mode');
    expect(host.querySelector('.showcase-code')?.textContent).toContain('active: true');

    toggle.click();
    await fixture.whenStable();

    expect(kiosk.active()).toBe(false);
  });

  it('hold the toolbar so the pointer is not idle, until the hold is released', async () => {
    vi.useFakeTimers();
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    fixture.detectChanges();
    const [, hold] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    hold.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS * 2);
    expect(kiosk.pointerIdle()).toBe(false);
    expect(hold.getAttribute('aria-pressed')).toBe('true');

    hold.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);
    expect(kiosk.pointerIdle()).toBe(true);
    expect(hold.getAttribute('aria-pressed')).toBe('false');
  });

  it('release a hold that is still taken when the example goes', async () => {
    vi.useFakeTimers();
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelectorAll('button')[1].click();

    fixture.destroy();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);

    expect(kiosk.pointerIdle()).toBe(true);
  });

  it('unfold the active page’s three sub-pages in the expanded rail, the first one open', async () => {
    localStorage.setItem('neat-ui:rail-expanded', 'true');
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/demo/shell/rail-items');
    const fixture = TestBed.createComponent(RailItems);
    await fixture.whenStable();
    const rail = (fixture.nativeElement as HTMLElement).querySelector(
      'neat-shell nav',
    ) as HTMLElement;
    const children = Array.from(rail.querySelectorAll<HTMLElement>('ul ul a'));

    expect(children.map((child) => child.textContent?.trim())).toEqual([
      'Overview',
      'Devices',
      'Settings',
    ]);
    expect(children.map((child) => child.getAttribute('aria-current'))).toEqual([
      'page',
      null,
      null,
    ]);
    localStorage.clear();
  });

  it('fill the rail’s end slot: the app’s items, then the theme, then collapse', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const status = vi.spyOn(TestBed.inject(NeatToasts), 'status');
    const fixture = TestBed.createComponent(RailItems);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // Its own shell, with two pages in the rail.
    expect(host.querySelectorAll('neat-shell nav > ul > li > a[neatRailItem]').length).toBe(2);
    const end = host.querySelector('neat-shell .rail-end') as HTMLElement;
    const items = Array.from(end.querySelectorAll('[neatRailItem]'), (item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(items.length).toBe(6);
    expect([items[0], items[5]]).toEqual(['About this app', 'Dark theme']);
    // The second says a board's state with the item's tone, text and detail.
    const board = end.querySelector('[label="Demo board, 192.168.1.20, connected"]') as HTMLElement;
    const lines = Array.from(board.querySelectorAll('.line'), (line) => line.textContent?.trim());
    expect(lines).toEqual(['Demo board', '192.168.1.20']);
    expect(board.getAttribute('data-tone')).toBe('success');
    expect(board.querySelector('.dot')).not.toBeNull();
    // The items after it show the other tones, each on the rail's own surface.
    const tones = Array.from(end.querySelectorAll('[neatRailItem][data-tone]'), (item) =>
      item.getAttribute('data-tone'),
    );
    expect(tones).toEqual(['success', 'warning', 'danger', 'neutral']);
    // A divider of the app's own sets the devices apart from the items below them.
    const last = end.querySelector('[label="Microphone, idle"]') as HTMLElement;
    expect(last.nextElementSibling?.matches('hr[neatRailDivider]')).toBe(true);

    board.click();

    expect(status).toHaveBeenCalledWith('A board item would open its dialog here.');
  });
});
