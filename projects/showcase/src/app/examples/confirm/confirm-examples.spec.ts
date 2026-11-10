import { TestBed } from '@angular/core/testing';
import { Asking } from './1-asking.example';

const dialog = (): HTMLElement | null => document.querySelector('[role="alertdialog"]');
const pressed = (label: string): void => {
  const button = Array.from(dialog()!.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  button!.click();
};

describe('the confirm examples', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  async function setup() {
    const fixture = TestBed.createComponent(Asking);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const answer = () => host.querySelector('.showcase-code')?.textContent?.trim();
    return { host, settle, answer, buttons: Array.from(host.querySelectorAll('button')) };
  }

  it('ask the danger question and show the answer of the button pressed', async () => {
    const { buttons, settle, answer } = await setup();
    expect(answer()).toBe('Not asked yet');

    buttons[0].focus();
    buttons[0].click();
    await settle();

    expect(dialog()?.querySelector('h2')?.textContent).toBe('Reset all channels to global?');
    pressed('Reset');
    await settle();

    expect(answer()).toBe('Reset all: confirmed');
    // Focus is back on the button that asked.
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('word the second question’s cancel button, and answer false for it', async () => {
    const { buttons, settle, answer } = await setup();

    buttons[1].focus();
    buttons[1].click();
    await settle();

    expect(Array.from(dialog()!.querySelectorAll('button'), (b) => b.textContent?.trim())).toEqual([
      'Not now',
      'Apply',
    ]);
    pressed('Not now');
    await settle();

    expect(answer()).toBe('Apply to all: canceled');
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('answer false when Escape closes the question', async () => {
    const { buttons, settle, answer } = await setup();

    buttons[0].focus();
    buttons[0].click();
    await settle();
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle();

    expect(answer()).toBe('Reset all: canceled');
    expect(document.activeElement).toBe(buttons[0]);
  });
});
