import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NEAT_LISTENING_MOTIONS,
  NeatMessageBox,
  type NeatChatPicture,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

const NAMES: Record<NeatListeningMotion, string> = {
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

/**
 * The message box with push-to-talk (`talk`) and the camera (`camera`): hold the microphone and
 * speak, or tap it twice, and the box emits the recording, which an app sends to speech-to-text
 * while `transcribing` (the example pretends for a moment and shows its size). Camera opens a
 * dialog with the laptop camera's preview, and Take adds the photo to the draft. Pick how the
 * voice shows while it records; in the message box, the waveform takes the text's place.
 *
 * @capture click neat-message-box button:has(neat-icon[data-icon="camera"])
 */
@Component({
  selector: 'app-voice-and-camera',
  imports: [NeatMessageBox, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-voice-and-camera.example.html',
  styleUrl: './voice-and-camera.example.css',
})
export class VoiceAndCamera {
  protected readonly motions: readonly NeatSelectOption<NeatListeningMotion>[] =
    NEAT_LISTENING_MOTIONS.map((motion) => ({ value: motion, label: NAMES[motion] }));
  protected readonly motion = signal<NeatListeningMotion | null>('in-message-box');
  protected readonly pictures = signal<readonly NeatChatPicture[]>([]);
  protected readonly transcribing = signal(false);
  protected readonly last = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onRecorded(recording: Blob): void {
    // An app sends the recording to speech-to-text here; the example pretends for 0.6 s.
    this.transcribing.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.transcribing.set(false), 600);
    this.last.set(`${Math.round(recording.size / 1000)} kB`);
  }
}
