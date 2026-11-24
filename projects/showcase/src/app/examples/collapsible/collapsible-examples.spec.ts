import { TestBed } from '@angular/core/testing';
import { EndControls } from './2-end-controls.example';
import { UnderAField } from './3-under-a-field.example';
import { SummaryAndSave } from './1-summary-and-save.example';

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  /** A section's trigger, found by the name its label gives it. */
  const trigger = (label: string): HTMLButtonElement =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('[data-slot="collapsible-trigger"]')).find(
      (button) => button.textContent?.includes(label),
    )!;
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  return { fixture, host, trigger, button };
}

describe('the collapsible examples', () => {
  it('say what a closed section holds, and drop the summary once it is open', async () => {
    const { fixture, host, trigger } = await render(SummaryAndSave);

    expect(trigger('Details').getAttribute('aria-expanded')).toBe('false');
    expect(trigger('Details').textContent).toContain('IMX219 · MIPI CSI · NV12');

    trigger('Details').click();
    await fixture.whenStable();

    expect(trigger('Details').getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-slot="collapsible-summary"]')).toBeNull();
  });

  it('close the section on Save and put the focus on its button', async () => {
    const { fixture, trigger, button } = await render(SummaryAndSave);

    trigger('Change board').click();
    await fixture.whenStable();
    button('Save')!.focus();
    button('Save')!.click();
    await fixture.whenStable();

    expect(trigger('Change board').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger('Change board'));
  });

  it('keep Add line at the end of the row, and Clear only while the log is open', async () => {
    const { fixture, host, trigger, button } = await render(EndControls);

    expect(trigger('Log').textContent).toContain('3 lines');
    expect(button('Add line')).toBeDefined();
    expect(button('Clear')).toBeUndefined();

    button('Add line')!.click();
    await fixture.whenStable();
    expect(trigger('Log').textContent).toContain('4 lines');

    trigger('Log').click();
    await fixture.whenStable();
    expect(button('Clear')).toBeDefined();
    expect(host.querySelectorAll('p')).toHaveLength(4);

    button('Clear')!.click();
    await fixture.whenStable();
    expect(host.querySelector('p')?.textContent?.trim()).toBe('No lines.');
    expect(trigger('Log').getAttribute('aria-expanded')).toBe('true');
  });

  it('describe the field by the note, and open it into the two channels', async () => {
    const { fixture, host, trigger, button } = await render(UnderAField);
    const input = host.querySelector('input')!;
    const note = trigger('Overridden on 2 channels');

    expect(note.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toBe(note.id);
    expect(note.getAttribute('aria-expanded')).toBe('false');

    note.click();
    await fixture.whenStable();

    expect(note.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(host.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      expect.stringContaining('Channel 3'),
      expect.stringContaining('Channel 7'),
    ]);
    // Each line's action is the line's end, which only `NeatLineEnd` makes so.
    expect(button('Use global')!.classList).toContain('ms-auto');
  });
});
