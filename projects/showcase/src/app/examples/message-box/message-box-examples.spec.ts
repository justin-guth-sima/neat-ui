import { TestBed } from '@angular/core/testing';
import { MessageBox } from './1-message-box.example';
import { RestoringADraft } from './2-restoring-a-draft.example';

describe('the message box examples', () => {
  afterEach(() => vi.useRealTimers());

  it('the message box example sends a typed draft and runs through its activities', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(MessageBox);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const box = host.querySelector('neat-message-box')!;
    const area = host.querySelector('textarea')!;
    area.value = 'What is on the shelf?';
    area.dispatchEvent(new Event('input'));
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    fixture.detectChanges();
    expect(host.querySelector('.sent')?.textContent).toContain('What is on the shelf?');
    expect(box.getAttribute('data-activity')).toBe('idle');
    await vi.advanceTimersByTimeAsync(800);
    fixture.detectChanges();
    expect(box.getAttribute('data-activity')).toBe('waiting');
    await vi.advanceTimersByTimeAsync(1200);
    fixture.detectChanges();
    expect(box.getAttribute('data-activity')).toBe('streaming');
  });

  it('the draft example starts with its text', () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    const fixture = TestBed.createComponent(RestoringADraft);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'What could I cook with this?',
    );
    vi.unstubAllGlobals();
  });
});
