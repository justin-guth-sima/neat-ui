import { TestBed } from '@angular/core/testing';
import { PageWithALimit } from './1-page-with-a-limit.example';
import { AnyWholeNumber } from './2-any-whole-number.example';
import { StepsAndAUnit } from './3-steps-and-a-unit.example';

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const input = host.querySelector('input')!;
  const status = () => host.querySelector('.showcase-code')?.textContent?.trim();
  /** Types into the field and presses Enter. */
  const commit = async (typed: string): Promise<void> => {
    input.value = typed;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
  };
  return { fixture, host, input, status, commit };
}

describe('the number field examples', () => {
  it('accept a page from 1 to 9 and count the commits, the repeated number too', async () => {
    const { host, input, status, commit } = await render(PageWithALimit);

    expect(input.getAttribute('aria-label')).toBe('Page');
    expect(host.querySelector('label')?.textContent).toContain('of 9');
    expect(status()).toBe('Page 3, commits so far 0');

    await commit('5');
    expect(status()).toBe('Page 5, commits so far 1');

    await commit('5');
    expect(status()).toBe('Page 5, commits so far 2');
  });

  it('put the shown page back for a number out of range or not a number', async () => {
    const { input, status, commit } = await render(PageWithALimit);

    await commit('12');
    expect(input.value).toBe('3');

    await commit('five');
    expect(input.value).toBe('3');
    expect(status()).toBe('Page 3, commits so far 0');
  });

  it('focus the page field with its number selected from the button', async () => {
    const { fixture, host, input } = await render(PageWithALimit);
    const select = vi.spyOn(input, 'select');

    host.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(input);
    expect(select).toHaveBeenCalled();
  });

  it('take any whole number without an accept function', async () => {
    const { status, commit } = await render(AnyWholeNumber);

    expect(status()).toBe('Channel 2');
    await commit('4096');
    expect(status()).toBe('Channel 4096');
  });

  it('step a frame rate with + and show what was committed', async () => {
    const { fixture, host, input, status } = await render(StepsAndAUnit);

    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(status()).toBe('Committed 16 fps');

    host.querySelector<HTMLButtonElement>('button[aria-label="Increase Frame rate"]')!.click();
    await fixture.whenStable();

    expect(status()).toBe('Committed 21 fps');
    expect(input.getAttribute('aria-valuetext')).toBe('21 fps');
  });
});
