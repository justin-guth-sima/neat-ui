import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchesInAPanel } from './1-switches-in-a-panel.example';
import { AlignedToTheEnd } from './2-aligned-to-the-end.example';
import { Menu } from './3-menu.example';

const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]');

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    '[neatPopoverTrigger]',
  )!;
  // jsdom lays nothing out: give the viewport a size and put the trigger in its middle, so the
  // panel fits and does not flip.
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  trigger.getBoundingClientRect = () => new DOMRect(472, 368, 40, 32);
  /** Runs pending timers and render hooks: focus moves after render, and closing waits a frame. */
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
  };
  return { fixture, trigger, settle };
}

const status = (fixture: ComponentFixture<unknown>): string | undefined =>
  (fixture.nativeElement as HTMLElement).querySelector('.showcase-code')?.textContent?.trim();

describe('the popover examples', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('open a panel of switches whose values the page keeps', async () => {
    const { fixture, trigger, settle } = await render(SwitchesInAPanel);
    expect(status(fixture)).toBe('View options closed; bars on, empty slots shown');

    trigger.click();
    await settle();
    const [bars, hideEmpty] = Array.from(panel()!.querySelectorAll<HTMLButtonElement>('button'));
    bars.click();
    hideEmpty.click();
    await settle();

    expect(status(fixture)).toBe('View options open; bars off, empty slots hidden');

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle();

    expect(status(fixture)).toBe('View options closed; bars off, empty slots hidden');
    // Focus goes back to the trigger.
    expect(document.activeElement).toBe(trigger);

    // The content was destroyed with the panel; the switches come back as the page kept them.
    trigger.click();
    await settle();
    const again = Array.from(panel()!.querySelectorAll('button'), (b) =>
      b.getAttribute('aria-checked'),
    );
    expect(again).toEqual(['false', 'true']);
  });

  it('open a field aligned to the trigger’s end and keep what is typed', async () => {
    const { fixture, trigger, settle } = await render(AlignedToTheEnd);
    expect(status(fixture)).toBe('Go to channel closed; channel none');

    trigger.click();
    await settle();
    const field = panel()!.querySelector<HTMLInputElement>('input')!;
    expect(document.activeElement).toBe(field);
    expect(panel()!.textContent).toContain("Aligned to the trigger's end edge.");
    field.value = '7';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(status(fixture)).toBe('Go to channel open; channel 7');
  });

  it('open a menu of rows with a divider, the first enabled row taking the focus', async () => {
    const { trigger, settle } = await render(Menu);

    trigger.click();
    await settle();
    const rows = Array.from(panel()!.querySelectorAll<HTMLButtonElement>('[neatPopoverItem]'));

    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      'Rename',
      'Duplicate',
      'Move…',
      'Delete',
    ]);
    expect(rows.map((row) => row.disabled)).toEqual([false, false, true, false]);
    expect(panel()!.querySelector('hr')?.getAttribute('role')).toBe('separator');
    expect(document.activeElement).toBe(rows[0]);
  });
});
