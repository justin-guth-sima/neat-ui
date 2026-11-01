import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RenameASource } from './1-rename-a-source.example';
import { LongContent } from './2-long-content.example';
import { ComponentWithInputs } from './3-component-with-inputs.example';

const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]');
const label = (button: Element): string | undefined => button.textContent?.trim();
const pressed = (text: string): void =>
  Array.from(dialog()!.querySelectorAll('button'))
    .find((button) => label(button) === text)!
    .click();
/** The width class of the `large` size (the panel's size table); jsdom lays nothing out. */
const LARGE_WIDTH = 'sm:w-3xl';
const escape = (): boolean =>
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );

async function open<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  const app = TestBed.inject(ApplicationRef);
  // Fake timers stop `whenStable`, so the app is ticked by hand after each step.
  const settle = async (ms = 0): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    app.tick();
  };
  app.tick();
  const host = fixture.nativeElement as HTMLElement;
  const result = () => host.querySelector('.showcase-code')?.textContent?.trim();
  // The dialog gives focus back to the button that opened it, which had focus when it was pressed.
  const opener = host.querySelector('button')!;
  opener.focus();
  opener.click();
  await settle();
  return { fixture, host, settle, result, opener };
}

describe('the dialog examples', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  describe('rename a source', () => {
    it('open a dialog named by its title and return the name it was saved with', async () => {
      const { settle, result, opener } = await open(RenameASource);
      expect(result()).toBe('Not opened yet');
      expect(dialog()?.querySelector('h2')?.textContent).toContain('Rename source');

      pressed('Save');
      await settle();
      // Saving takes a moment, which the buttons say.
      expect(Array.from(dialog()!.querySelectorAll('button'), label)).toContain('Saving…');
      await settle(1500);
      // The dialog plays its exit animation before `closed` settles.
      await settle(500);

      expect(result()).toBe('Rename: saved "Front door"');
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it('block dismissing while it saves, and settle undefined when it is dismissed', async () => {
      const { settle, result } = await open(RenameASource);

      pressed('Save');
      await settle();
      escape();
      await settle();

      expect(dialog()).not.toBeNull();
      await settle(1500);
      expect(dialog()).toBeNull();

      // A dialog that is dismissible closes on Escape with no result.
      const second = await open(RenameASource);
      escape();
      await second.settle(500);

      expect(second.result()).toBe('Rename: dismissed');
      expect(document.activeElement).toBe(second.opener);
      expect(result()).toBe('Rename: saved "Front door"');
    });

    it('turn the dismissing off from the switch', async () => {
      const { settle, result } = await open(RenameASource);
      const toggle = dialog()!.querySelector<HTMLButtonElement>('button[role="switch"]')!;
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      toggle.click();
      await settle();
      escape();
      await settle();

      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(dialog()).not.toBeNull();
      expect(result()).toBe('Not opened yet');
    });
  });

  it('show 40 lines of content in a large dialog that Done closes', async () => {
    const { settle, result, opener } = await open(LongContent);

    expect(dialog()?.querySelectorAll('li')).toHaveLength(40);
    // The large size is the 3xl width; the medium one, which a dialog has by default, is lg.
    expect(dialog()?.querySelector(`[class*="${LARGE_WIDTH}"]`)).not.toBeNull();
    pressed('Done');
    await settle();

    expect(result()).toBe('Sources: closed');
    expect(document.activeElement).toBe(opener);
  });

  describe('a component with inputs', () => {
    const selected = (): (string | undefined)[] =>
      Array.from(dialog()!.querySelectorAll('[role="radio"]'))
        .filter((option) => option.getAttribute('aria-checked') === 'true')
        .map(label);

    it('start on the kind the opener passed and return the one chosen', async () => {
      const { settle, result, opener } = await open(ComponentWithInputs);

      expect(dialog()?.querySelector('[aria-label="Source for src3"]')).not.toBeNull();
      expect(selected()).toHaveLength(1);
      expect(selected()[0]).toContain('Camera');
      pressed('Use camera');
      await settle();

      expect(result()).toBe('Source: camera');
      expect(document.activeElement).toBe(opener);
    });

    it('settle undefined on Cancel', async () => {
      const { settle, result } = await open(ComponentWithInputs);

      pressed('Cancel');
      await settle();

      expect(result()).toBe('Source: dismissed');
    });
  });
});
