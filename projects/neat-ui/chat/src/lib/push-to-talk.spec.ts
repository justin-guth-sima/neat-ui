import { Component, NgZone, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CHAT_CLOCK } from './chat-clock';
import {
  HOLD_MS,
  NEAT_LISTENING_MOTIONS,
  NeatPushToTalk,
  type NeatListeningMotion,
} from './push-to-talk';
import { FakeMediaRecorder, fakeMicDeps, flush } from './voice/media.testing';
import { MIC_DEPS } from './voice/mic-deps';
import type { MicDeps } from './voice/mic-recorder';

@Component({
  imports: [NeatPushToTalk],
  template: `@if (shown()) {
    <neat-push-to-talk
      [(recording)]="recording"
      [transcribing]="transcribing()"
      [disabled]="disabled()"
      [listeningMotion]="motion()"
      (recorded)="recordings.push($event)"
    />
  }`,
})
class Host {
  readonly shown = signal(true);
  readonly recording = signal(false);
  readonly transcribing = signal(false);
  readonly disabled = signal(false);
  readonly motion = signal<NeatListeningMotion>('in-message-box');
  readonly recordings: Blob[] = [];
}

function render(overrides: Partial<MicDeps> = {}) {
  const fake = fakeMicDeps(overrides);
  TestBed.configureTestingModule({
    providers: [
      { provide: MIC_DEPS, useValue: fake.deps },
      { provide: CHAT_CLOCK, useValue: fake.clock },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const host = fixture.componentInstance;
  const element = () => fixture.nativeElement.querySelector('neat-push-to-talk') as HTMLElement;
  const button = () => element().querySelector('button') as HTMLButtonElement;
  const pointer = (type: 'pointerdown' | 'pointerup') => {
    const event = new MouseEvent(type, { button: 0, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    button().dispatchEvent(event);
    fixture.detectChanges();
  };
  const key = (type: 'keydown' | 'keyup', key: string, repeat = false) => {
    const event = new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true });
    button().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  /** Lets the microphone's answer and the recorder's last chunk come, then renders. */
  const settle = async () => {
    await flush();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const state = () => element().getAttribute('data-state');
  const note = () => element().querySelector('.note')!.textContent!.trim();
  return { fake, fixture, host, element, button, pointer, key, settle, state, note };
}

/** Makes the page ask for reduced motion until the spec ends. */
function reduceMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('NeatPushToTalk', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the listening motions in order, the message box's default first", () => {
    expect(NEAT_LISTENING_MOTIONS).toEqual(['in-message-box', 'radial']);
  });

  it('a press then a release after 300 ms records and emits one recording', async () => {
    const t = render();
    t.pointer('pointerdown');
    expect(t.state()).toBe('asking');
    expect(t.host.recording()).toBe(true);
    t.fake.mediaDevices.grant();
    await t.settle();
    expect(t.state()).toBe('recording');
    t.fake.advance(2000);
    t.pointer('pointerup');
    await t.settle();
    expect(t.host.recordings.length).toBe(1);
    expect(t.host.recordings[0].type).toBe('audio/webm;codecs=opus');
    expect(t.host.recording()).toBe(false);
    expect(t.state()).toBe('idle');
  });

  it('a quick tap starts, the next tap stops and emits', async () => {
    const t = render();
    t.pointer('pointerdown');
    t.fake.mediaDevices.grant();
    await t.settle();
    t.fake.advance(HOLD_MS - 100);
    t.pointer('pointerup');
    await t.settle();
    expect(t.state()).toBe('recording');
    t.fake.advance(1500);
    t.pointer('pointerdown');
    await t.settle();
    t.pointer('pointerup');
    await t.settle();
    expect(t.host.recordings.length).toBe(1);
    expect(t.state()).toBe('idle');
  });

  it('Space held then released records; Enter tapped twice records', async () => {
    const t = render();
    const down = t.key('keydown', ' ');
    expect(down.defaultPrevented).toBe(true);
    t.key('keydown', ' ', true);
    t.fake.mediaDevices.grant();
    await t.settle();
    t.fake.advance(1000);
    t.key('keyup', ' ');
    await t.settle();
    expect(t.host.recordings.length).toBe(1);

    t.key('keydown', 'Enter');
    t.fake.mediaDevices.grant();
    await t.settle();
    t.key('keyup', 'Enter');
    await t.settle();
    expect(t.state()).toBe('recording');
    t.fake.advance(1000);
    t.key('keydown', 'Enter');
    await t.settle();
    t.key('keyup', 'Enter');
    await t.settle();
    expect(t.host.recordings.length).toBe(2);
  });

  it('Escape while recording cancels and emits nothing', async () => {
    const t = render();
    t.key('keydown', 'Enter');
    t.fake.mediaDevices.grant();
    await t.settle();
    t.key('keyup', 'Enter');
    t.fake.advance(1000);
    t.key('keydown', 'Escape');
    await t.settle();
    expect(t.state()).toBe('idle');
    expect(t.host.recordings).toEqual([]);
    expect(t.fake.mediaDevices.streams[0].stopped()).toBe(true);
    expect(t.note()).toBe('');
  });

  it('a hold released while asking records nothing', async () => {
    const t = render();
    t.pointer('pointerdown');
    t.fake.advance(HOLD_MS + 200);
    t.pointer('pointerup');
    await t.settle();
    expect(t.state()).toBe('idle');
    expect(t.host.recording()).toBe(false);
    const stream = t.fake.mediaDevices.grant();
    await t.settle();
    expect(stream.stopped()).toBe(true);
    expect(FakeMediaRecorder.made).toEqual([]);
    expect(t.state()).toBe('idle');
  });

  it('a tap while asking records once granted', async () => {
    const t = render();
    t.pointer('pointerdown');
    t.fake.advance(100);
    t.pointer('pointerup');
    t.fake.advance(3000);
    t.fake.mediaDevices.grant();
    await t.settle();
    expect(t.state()).toBe('recording');
    t.fake.advance(1000);
    t.pointer('pointerdown');
    t.pointer('pointerup');
    await t.settle();
    expect(t.host.recordings.length).toBe(1);
  });

  it('its name follows the state: Record question, Stop recording, Transcribing', async () => {
    const t = render();
    expect(t.button().getAttribute('aria-label')).toBe('Record question');
    expect(t.button().querySelector('neat-icon')!.getAttribute('data-icon')).toBe('microphone');
    t.pointer('pointerdown');
    expect(t.button().getAttribute('aria-label')).toBe('Stop recording');
    t.fake.mediaDevices.grant();
    await t.settle();
    expect(t.button().getAttribute('aria-label')).toBe('Stop recording');
    expect(t.button().querySelector('neat-icon')!.getAttribute('data-icon')).toBe('stop');
    t.fake.advance(1000);
    t.pointer('pointerup');
    await t.settle();
    t.host.transcribing.set(true);
    t.fixture.detectChanges();
    expect(t.state()).toBe('transcribing');
    expect(t.button().getAttribute('aria-label')).toBe('Transcribing');
    expect(t.button().querySelector('neat-icon')!.getAttribute('data-icon')).toBe('spinner');
    expect(t.button().hasAttribute('aria-pressed')).toBe(false);
  });

  it('while transcribing it is aria-disabled and a press does nothing', () => {
    const t = render();
    t.host.transcribing.set(true);
    t.fixture.detectChanges();
    expect(t.button().getAttribute('aria-disabled')).toBe('true');
    expect(t.button().getAttribute('aria-busy')).toBe('true');
    t.pointer('pointerdown');
    t.key('keydown', ' ');
    expect(t.fake.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(t.state()).toBe('transcribing');
    t.host.recording.set(true);
    t.fixture.detectChanges();
    expect(t.fake.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(t.host.recording()).toBe(false);
  });

  it('says Microphone blocked and No microphone in place, and clears it on the next press', async () => {
    const t = render();
    const describedBy = t.button().getAttribute('aria-describedby')!;
    expect(t.element().querySelector(`#${describedBy}`)!.getAttribute('role')).toBe('status');
    t.pointer('pointerdown');
    t.fake.mediaDevices.refuse('NotAllowedError');
    await t.settle();
    t.pointer('pointerup');
    expect(t.note()).toBe('Microphone blocked');
    expect(t.state()).toBe('idle');
    t.pointer('pointerdown');
    expect(t.note()).toBe('');
    t.fake.mediaDevices.refuse('NotFoundError');
    await t.settle();
    t.pointer('pointerup');
    expect(t.note()).toBe('No microphone');
  });

  it('a recording too short says so', async () => {
    const t = render();
    t.key('keydown', 'Enter');
    t.fake.mediaDevices.grant();
    await t.settle();
    t.key('keyup', 'Enter');
    t.fake.advance(200);
    t.key('keydown', 'Enter');
    await t.settle();
    expect(t.note()).toBe('Too short');
    expect(t.host.recordings).toEqual([]);
  });

  it('disabled while recording cancels and stops the tracks; so does destroying it', async () => {
    let t = render();
    t.pointer('pointerdown');
    const stream = t.fake.mediaDevices.grant();
    await t.settle();
    t.host.disabled.set(true);
    t.fixture.detectChanges();
    await t.settle();
    expect(stream.stopped()).toBe(true);
    expect(t.state()).toBe('idle');
    expect(t.host.recording()).toBe(false);
    expect(t.button().getAttribute('aria-disabled')).toBe('true');
    t.pointer('pointerup');
    await t.settle();
    expect(t.host.recordings).toEqual([]);

    TestBed.resetTestingModule();
    t = render();
    t.pointer('pointerdown');
    const second = t.fake.mediaDevices.grant();
    await t.settle();
    t.host.shown.set(false);
    t.fixture.detectChanges();
    await t.settle();
    expect(second.stopped()).toBe(true);
    expect(t.fake.context()!.state).toBe('closed');
    expect(t.host.recordings).toEqual([]);
  });

  it('setting recording true starts and false stops', async () => {
    const t = render();
    t.host.recording.set(true);
    t.fixture.detectChanges();
    expect(t.fake.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(t.state()).toBe('asking');
    t.fake.mediaDevices.grant();
    await t.settle();
    expect(t.state()).toBe('recording');
    t.fake.advance(1000);
    t.host.recording.set(false);
    t.fixture.detectChanges();
    await t.settle();
    expect(t.host.recordings.length).toBe(1);
    expect(t.state()).toBe('idle');
  });

  it('a start that fails at once sets recording back to false', () => {
    const t = render({ isSecureContext: false });
    t.host.recording.set(true);
    t.fixture.detectChanges();
    expect(t.host.recording()).toBe(false);
    expect(t.note()).toBe('Microphone needs HTTPS');
  });

  describe('the listening motions', () => {
    /** Starts recording in a motion, granted. */
    async function recordIn(motion: NeatListeningMotion) {
      const t = render();
      t.host.motion.set(motion);
      t.fixture.detectChanges();
      t.pointer('pointerdown');
      t.fake.mediaDevices.grant();
      await t.settle();
      return t;
    }

    it('the ring and radial make their engine while recording and drop it once it rests', async () => {
      for (const [motion, selector, folds] of [
        ['in-message-box', '.ring', 0],
        ['radial', 'canvas.radial', 350],
      ] as const) {
        TestBed.resetTestingModule();
        const t = await recordIn(motion);
        expect(t.element().querySelector(selector), motion).not.toBeNull();
        expect(t.element().querySelector('neat-level-meter, .elapsed'), motion).toBeNull();
        t.fake.clock.frame(16);
        t.fake.advance(1000);
        t.pointer('pointerup');
        await t.settle();
        t.fake.clock.frame(folds + 20);
        t.fixture.detectChanges();
        await t.settle();
        expect(t.element().querySelector(selector), motion).toBeNull();
        expect(t.fake.clock.pending(), motion).toBe(false);
      }
    });

    it('under reduced motion every motion says Recording and its time, still, with no engine', async () => {
      reduceMotion();
      for (const motion of NEAT_LISTENING_MOTIONS) {
        TestBed.resetTestingModule();
        const t = await recordIn(motion);
        const elapsed = () => t.element().querySelector('.elapsed')?.textContent?.trim();
        expect(elapsed(), motion).toBe('Recording 0 s');
        t.fake.advance(3000);
        t.fixture.detectChanges();
        expect(elapsed(), motion).toBe('Recording 3 s');
        expect(
          t.element().querySelector('neat-level-meter, .wave, .ring, canvas'),
          motion,
        ).toBeNull();
        expect(t.fake.clock.pending(), motion).toBe(false);
        t.fake.advance(1000);
        t.pointer('pointerup');
        await t.settle();
        expect(t.element().querySelector('.elapsed'), motion).toBeNull();
      }
    });

    it('writes nothing per second while the seconds are not shown, so no change detection runs', async () => {
      const t = await recordIn('in-message-box');
      const run = vi.spyOn(TestBed.inject(NgZone), 'run');
      t.fake.advance(3000);
      expect(run).not.toHaveBeenCalled();
      run.mockRestore();
    });

    it('in-message-box alone draws the ring round the button, and no waveform', async () => {
      const t = await recordIn('in-message-box');
      expect(t.element().querySelector('.ring')).not.toBeNull();
      expect(t.element().querySelector('.wave, canvas, neat-level-meter, .elapsed')).toBeNull();
    });
  });
});
