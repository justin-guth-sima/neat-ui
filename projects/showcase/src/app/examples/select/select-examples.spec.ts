import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LabelPositions } from './1-label-positions.example';
import { InADialog } from './2-in-a-dialog.example';
import { WithANote } from './3-with-a-note.example';

describe('the select examples', () => {
  beforeEach(() => {
    // jsdom has no scrollIntoView, which brain calls on the active option.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('name each select, show the label above, hidden or inline, and disable the last', async () => {
    const fixture = TestBed.createComponent(LabelPositions);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const selects = Array.from(host.querySelectorAll('neat-select'));
    const trigger = (select: Element) => select.querySelector<HTMLButtonElement>('button')!;

    expect(selects.map((select) => trigger(select).getAttribute('aria-label'))).toEqual([
      'Source',
      'Source, label hidden',
      'Source',
      'Disabled',
    ]);
    expect(selects.map((select) => select.querySelector('label')?.textContent?.trim())).toEqual([
      'Source',
      undefined,
      'Source',
      undefined,
    ]);
    expect(trigger(selects[3]).disabled).toBe(true);
    expect(trigger(selects[3]).textContent).toContain('RTSP stream');
    expect(trigger(selects[0]).textContent).toContain('Pick a source');
  });

  it('share one value among the first three selects', async () => {
    const fixture = TestBed.createComponent(LabelPositions);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [first, second] = Array.from(
      host.querySelectorAll<HTMLButtonElement>('neat-select button'),
    );

    first.click();
    await fixture.whenStable();
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (candidate) => candidate.textContent?.trim() === 'Warehouse clip',
    )!;
    option.click();
    await fixture.whenStable();

    expect(second.textContent).toContain('Warehouse clip');
    expect(host.querySelector('.showcase-code')?.textContent?.trim()).toBe('Selected: clip');
  });
});

describe('the select with a note example', () => {
  it('describes the trigger by the note under it', async () => {
    const fixture = TestBed.createComponent(WithANote);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const note = host.querySelector('p')!;

    expect(host.querySelector('button')!.getAttribute('aria-describedby')).toBe(note.id);
    expect(note.textContent).toContain('Overridden on 2 channels');
  });
});

describe('the select in a dialog example', () => {
  const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]');
  const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  const button = (text: string) =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  const escape = (): void => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  async function open() {
    const fixture = TestBed.createComponent(InADialog);
    const app = TestBed.inject(ApplicationRef);
    // Fake timers stop `whenStable`, so the app is ticked by hand after each step.
    const settle = async (ms = 0): Promise<void> => {
      await vi.advanceTimersByTimeAsync(ms);
      app.tick();
    };
    app.tick();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector('button')!.click();
    await settle();
    return { settle, result: () => host.querySelector('.showcase-code')?.textContent?.trim() };
  }

  it('assign the picked source when the dialog is confirmed', async () => {
    const { settle, result } = await open();
    expect(result()).toBe('Dialog not opened yet');

    dialog()!.querySelector<HTMLButtonElement>('neat-select button')!.click();
    await settle();
    options()
      .find((option) => option.textContent?.trim() === 'RTSP stream')!
      .click();
    await settle();
    button('Assign').click();
    await settle(500);

    expect(result()).toBe('Dialog assigned rtsp');
    expect(dialog()).toBeNull();
  });

  it('close the list on the first Escape and the dialog on the next', async () => {
    const { settle, result } = await open();

    dialog()!.querySelector<HTMLButtonElement>('neat-select button')!.click();
    await settle();
    expect(options().length).toBeGreaterThan(0);

    escape();
    await settle(500);
    expect(options()).toHaveLength(0);
    expect(dialog()).not.toBeNull();

    escape();
    await settle(500);
    expect(dialog()).toBeNull();
    expect(result()).toBe('Dialog dismissed');
  });
});
