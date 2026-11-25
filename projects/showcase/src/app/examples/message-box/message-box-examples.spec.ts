import { TestBed } from '@angular/core/testing';
import { MessageBox } from './1-message-box.example';
import { RestoringADraft } from './2-restoring-a-draft.example';
import { Glows } from './3-glows.example';
import { VoiceAndCamera } from './4-voice-and-camera.example';
import { By } from '@angular/platform-browser';
import { NeatMessageBox } from '@sima/neat-ui/chat';

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

  it('the glows example shows four boxes with their glows', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Glows);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const boxes = [...host.querySelectorAll('neat-message-box')];
    expect(boxes.map((box) => box.getAttribute('data-glow'))).toEqual([
      'comet',
      'ring',
      'aurora',
      'sheen',
    ]);
    expect(host.textContent).toContain('Glow ring');
    expect(boxes[0].getAttribute('data-activity')).toBe('idle');
    await vi.advanceTimersByTimeAsync(800);
    fixture.detectChanges();
    expect(boxes.every((box) => box.getAttribute('data-activity') === 'waiting')).toBe(true);
    await vi.advanceTimersByTimeAsync(1200);
    fixture.detectChanges();
    expect(boxes.every((box) => box.getAttribute('data-activity') === 'streaming')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    expect(boxes[0].getAttribute('data-activity')).toBe('idle');
  });

  it('the voice and camera example forwards its choices to the box', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    const fixture = TestBed.createComponent(VoiceAndCamera);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const box = fixture.debugElement.query(By.directive(NeatMessageBox))
      .componentInstance as NeatMessageBox;
    expect(box.talk()).toBe(true);
    expect(box.camera()).toBe(true);
    expect(box.listeningMotion()).toBe('in-message-box');
    expect(host.querySelector('neat-push-to-talk')).not.toBeNull();
    expect(
      [...host.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Camera',
      ),
    ).toBe(true);
    const select = host.querySelector('neat-select')!;
    expect(select.textContent).toContain('In the message box');
    vi.unstubAllGlobals();
  });
});
