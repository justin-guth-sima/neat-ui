import { TestBed } from '@angular/core/testing';
import { NeatToasts, type NeatProgressToast } from '@sima/neat-ui/toast';
import { Kinds } from './1-kinds.example';
import { Progress } from './2-progress.example';

/** Stands in for the toast the service returns, so the example’s reports can be read. */
function fakeToast() {
  return {
    update: vi.fn<NeatProgressToast['update']>(),
    done: vi.fn<NeatProgressToast['done']>(),
    fail: vi.fn<NeatProgressToast['fail']>(),
    dismiss: vi.fn<NeatProgressToast['dismiss']>(),
  };
}

describe('the toast examples', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('raise one toast of each kind from its button', async () => {
    const toasts = TestBed.inject(NeatToasts);
    const error = vi.spyOn(toasts, 'error').mockImplementation(() => undefined);
    const warning = vi.spyOn(toasts, 'warning').mockImplementation(() => undefined);
    const status = vi.spyOn(toasts, 'status').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(Kinds);
    await fixture.whenStable();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Error',
      'Warning',
      'Status',
    ]);
    buttons.forEach((button) => button.click());

    expect(error).toHaveBeenCalledWith(
      'Could not start src3: the stream is held by another publisher.',
    );
    expect(warning).toHaveBeenCalledWith(
      'Uploaded clip.mp4, but could not restart src2: it is in use.',
    );
    expect(status).toHaveBeenCalledWith('Stopped 2 sources.');
  });

  describe('progress', () => {
    const TICK = 250;

    async function run(button: number) {
      vi.useFakeTimers();
      const toast = fakeToast();
      const progress = vi
        .spyOn(TestBed.inject(NeatToasts), 'progress')
        .mockReturnValue(toast satisfies NeatProgressToast);
      const fixture = TestBed.createComponent(Progress);
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')[button].click();
      return { toast, progress };
    }

    it('report each file’s percent and then succeed', async () => {
      const { toast, progress } = await run(0);

      expect(progress).toHaveBeenCalledWith('Uploading 3 files');
      await vi.advanceTimersByTimeAsync(TICK);
      expect(toast.update).toHaveBeenLastCalledWith('clip-1.mp4 · file 1 of 3', 8);
      await vi.advanceTimersByTimeAsync(TICK * 20);

      expect(toast.update).toHaveBeenLastCalledWith('clip-3.mp4 · file 3 of 3', 96);
      expect(toast.done).toHaveBeenCalledWith('Uploaded 3 files.');
      expect(toast.fail).not.toHaveBeenCalled();
    });

    it('fail with the reason', async () => {
      const { toast } = await run(1);

      await vi.advanceTimersByTimeAsync(TICK * 20);

      expect(toast.fail).toHaveBeenCalledWith('Upload failed: no space left on the device.');
      expect(toast.done).not.toHaveBeenCalled();
    });

    it('report no percent while the length is unknown', async () => {
      const { toast } = await run(2);

      await vi.advanceTimersByTimeAsync(TICK * 3);

      expect(toast.update.mock.calls.map(([, percent]) => percent)).toEqual([null, null, null]);
    });

    it('take the toast away halfway, with no outcome', async () => {
      const { toast } = await run(3);

      await vi.advanceTimersByTimeAsync(TICK * 20);

      expect(toast.dismiss).toHaveBeenCalledOnce();
      expect(toast.update).toHaveBeenCalledTimes(5);
      expect(toast.done).not.toHaveBeenCalled();
      expect(toast.fail).not.toHaveBeenCalled();
    });
  });
});
