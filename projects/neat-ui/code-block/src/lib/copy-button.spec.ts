import { TestBed } from '@angular/core/testing';
import { NeatCopyButton } from './copy-button';

describe('NeatCopyButton', () => {
  let writeText: ReturnType<typeof vi.fn>;

  async function render(inline = false) {
    const fixture = TestBed.createComponent(NeatCopyButton);
    fixture.componentRef.setInput('text', "import { NeatX } from '@sima/neat-ui';");
    fixture.componentRef.setInput('what', 'import line');
    fixture.componentRef.setInput('inline', inline);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      button: host.querySelector('button') as HTMLButtonElement,
      status: host.querySelector('[role="status"]') as HTMLElement,
    };
  }

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('names what it copies and copies the text', async () => {
    const { fixture, button, status } = await render();

    expect(button.textContent?.trim()).toBe('Copy');
    expect(button.querySelector('neat-icon')?.getAttribute('data-icon')).toBe('copy');
    expect(button.getAttribute('aria-label')).toBe('Copy import line');
    expect(status.textContent?.trim()).toBe('');

    button.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith("import { NeatX } from '@sima/neat-ui';");
    expect(button.textContent?.trim()).toBe('Copied');
    expect(button.querySelector('neat-icon')?.getAttribute('data-icon')).toBe('check');
    expect(status.textContent?.trim()).toBe('Copied to the clipboard.');
  });

  it('says so when the browser refuses, and is ready again after a while', async () => {
    writeText.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const { fixture, button, status } = await render();
    // After the first render: a stable fixture waits on the timers these replace.
    vi.useFakeTimers();

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(button.textContent?.trim()).toBe('Could not copy');
    expect(status.textContent?.trim()).toBe('Could not copy: the browser refused the clipboard.');

    await vi.advanceTimersByTimeAsync(2500);
    fixture.detectChanges();

    expect(button.textContent?.trim()).toBe('Copy');
    expect(status.textContent?.trim()).toBe('');
  });

  it('fails the same way without a clipboard (a page served over plain http)', async () => {
    vi.stubGlobal('navigator', {});
    const { fixture, button } = await render();

    button.click();
    await fixture.whenStable();

    expect(button.textContent?.trim()).toBe('Could not copy');
  });

  it('sits in a line of text with a smaller icon, inline, and copies the same', async () => {
    const { fixture, button } = await render(true);

    expect(button.hasAttribute('neatinlinebutton')).toBe(true);
    expect(button.querySelector('neat-icon')?.getAttribute('data-icon')).toBe('copy');
    expect(button.getAttribute('aria-label')).toBe('Copy import line');

    button.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith("import { NeatX } from '@sima/neat-ui';");
    expect(button.textContent?.trim()).toBe('Copied');
  });
});
