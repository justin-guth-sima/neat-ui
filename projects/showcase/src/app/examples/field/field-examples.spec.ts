import { TestBed } from '@angular/core/testing';
import { HintAndError } from './1-hint-and-error.example';
import { ARowOfControls } from './2-a-row-of-controls.example';
import { ErrorNote } from './3-error-note.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('the field examples', () => {
  it('describe a control by its hint, or by its error and mark it invalid', async () => {
    const host = await render(HintAndError);
    const [url, startTime] = Array.from(host.querySelectorAll('input'));
    const describedBy = (control: HTMLElement) =>
      document.getElementById(control.getAttribute('aria-describedby') ?? '');

    expect(describedBy(url)?.textContent?.trim()).toBe('RTSP and RTSPS only.');
    expect(url.hasAttribute('aria-invalid')).toBe(false);
    expect(describedBy(startTime)?.textContent?.trim()).toBe('Use minutes and seconds, as 1:30.');
    expect(describedBy(startTime)?.getAttribute('role')).toBe('alert');
    expect(startTime.getAttribute('aria-invalid')).toBe('true');
  });

  it('give each size a row of controls, the number field in the small one only', async () => {
    const host = await render(ARowOfControls);
    const rows = Array.from(host.querySelectorAll('.row'));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelectorAll('neat-number-field').length)).toEqual([1, 0]);
    const validate = (row: Element) =>
      Array.from(row.querySelectorAll('button')).filter(
        (b) => b.textContent?.trim() === 'Validate',
      );
    expect(rows.map((row) => validate(row).length)).toEqual([1, 1]);
  });

  it('say a failure in an alert that keeps its line break', async () => {
    const host = await render(ErrorNote);
    const note = host.querySelector('neat-error-note')!;

    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toBe(
      'Could not validate the URL.\nyt-dlp: ERROR: [youtube] abc123: Video unavailable',
    );
  });
});
