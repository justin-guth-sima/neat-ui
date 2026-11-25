import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatDialogActions, NeatDialogBody, NeatDialogRef } from '@sima/neat-ui/dialog';
import { pictureFromFile } from '../pictures';
import type { NeatChatPicture } from '../types';
import { CAMERA_WORDS, type MediaProblem } from '../voice/media-problem';
import { CAMERA_DEPS, openCamera, stopStream, takePhoto } from './camera';

/** What to do about each problem, a line under its heading. */
const HELP: Record<MediaProblem, string> = {
  blocked: "Allow the camera for this site in the browser's settings, then try again.",
  missing: 'Connect a camera, then try again.',
  busy: 'Close the other program that uses the camera, then try again.',
  insecure: 'The camera works only on a page served over HTTPS.',
  unsupported: 'This browser cannot use a camera.',
};

/**
 * The camera dialog the message box opens (its `camera`): the camera's live preview and Take,
 * which closes the dialog with a picture of the frame. The preview is not mirrored, so writing
 * held up to the camera reads as the board will see it. A problem is said in place of the
 * preview, also a camera that goes away while it shows. The camera stops however the dialog
 * closes. Internal to the message box.
 */
@Component({
  selector: 'neat-chat-camera-dialog',
  imports: [NeatButton, NeatCallout, NeatDialogActions, NeatDialogBody],
  templateUrl: './camera-dialog.html',
  styleUrl: './camera-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraDialog {
  protected readonly problem = signal<MediaProblem | null>(null);
  protected readonly words = computed(() => {
    const problem = this.problem();
    return problem ? { heading: CAMERA_WORDS[problem], help: HELP[problem] } : null;
  });
  /** The video shows a frame, so Take can take it. */
  protected readonly ready = signal(false);
  protected readonly taking = signal(false);

  private readonly dialog = inject<NeatDialogRef<NeatChatPicture>>(NeatDialogRef);
  private readonly document = inject(DOCUMENT);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly stream = signal<MediaStream | null>(null);
  private gone = false;

  constructor() {
    void openCamera(inject(CAMERA_DEPS)).then((opened) => {
      if ('problem' in opened) return this.problem.set(opened.problem);
      // Closed while the browser asked: the camera goes straight back.
      if (this.gone) return stopStream(opened.stream);
      for (const track of opened.stream.getTracks()) {
        track.addEventListener('ended', () => this.lost(opened.stream), { once: true });
      }
      this.stream.set(opened.stream);
    });
    effect(() => {
      const video = this.video()?.nativeElement;
      const stream = this.stream();
      if (video && stream) video.srcObject = stream;
    });
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      const stream = this.stream();
      if (stream) stopStream(stream);
    });
  }

  /** The camera went away (unplugged, taken by another program): said in place of the preview. */
  private lost(stream: MediaStream): void {
    if (this.stream() !== stream) return;
    stopStream(stream);
    this.stream.set(null);
    this.ready.set(false);
    this.problem.set('missing');
  }

  protected cancel(): void {
    this.dialog.close();
  }

  protected async take(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || !this.ready() || this.taking()) return;
    this.taking.set(true);
    try {
      const file = await takePhoto(video, this.document, new Date());
      this.dialog.close({ ...pictureFromFile(file), name: 'Photo from the camera' });
    } finally {
      this.taking.set(false);
    }
  }
}
