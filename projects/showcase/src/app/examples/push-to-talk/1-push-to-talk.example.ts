import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NEAT_LISTENING_MOTIONS,
  NeatPushToTalk,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

/** What the example says about the last recording, and where it plays from. */
interface Recording {
  readonly words: string;
  readonly url: string;
}

const NAMES: Record<NeatListeningMotion, string> = {
  level: 'Level',
  'ring-and-waveform': 'Ring and waveform',
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

/**
 * Push-to-talk on its own: hold the button and speak, or tap it to start and tap again to stop.
 * The voice shows as the listening motion says while it records: a level meter, a ring and
 * waveform, or radial bars (in the message box is the message box's). The example shows the last recording's length and
 * size and plays it back; an app would send it to speech-to-text instead, and show `transcribing`
 * meanwhile, as the example does for a moment. The browser asks for the microphone on the first
 * press.
 */
@Component({
  selector: 'app-push-to-talk',
  imports: [NeatPushToTalk, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-push-to-talk.example.html',
  styleUrl: './push-to-talk.example.css',
})
export class PushToTalk {
  protected readonly motions: readonly NeatSelectOption<NeatListeningMotion>[] =
    NEAT_LISTENING_MOTIONS.filter((motion) => motion !== 'in-message-box').map((motion) => ({
      value: motion,
      label: NAMES[motion],
    }));
  protected readonly motion = signal<NeatListeningMotion | null>('ring-and-waveform');
  protected readonly transcribing = signal(false);
  protected readonly last = signal<Recording | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      const last = this.last();
      if (last) URL.revokeObjectURL(last.url);
    });
  }

  protected async onRecorded(recording: Blob): Promise<void> {
    // An app sends the recording to speech-to-text here; the example pretends for 0.6 s.
    this.transcribing.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.transcribing.set(false), 600);
    const seconds = await lengthOf(recording);
    const size = `${Math.round(recording.size / 1000)} kB`;
    const previous = this.last();
    if (previous) URL.revokeObjectURL(previous.url);
    this.last.set({
      words: seconds === null ? size : `${seconds.toFixed(1)} s · ${size}`,
      url: URL.createObjectURL(recording),
    });
  }
}

/** How long a recording plays, in seconds, decoded by the browser; null where it cannot. */
async function lengthOf(recording: Blob): Promise<number | null> {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  try {
    return (await context.decodeAudioData(await recording.arrayBuffer())).duration;
  } catch {
    return null;
  } finally {
    void context.close();
  }
}
