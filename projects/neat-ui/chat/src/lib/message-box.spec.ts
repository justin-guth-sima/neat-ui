import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NEAT_MESSAGE_BOX_GLOWS,
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from './message-box';
import { NeatDialog } from '@sima/neat-ui/dialog';
import { CameraDialog } from './camera/camera-dialog';
import { CHAT_CLOCK } from './chat-clock';
import type { NeatListeningMotion } from './push-to-talk';
import type { NeatChatDraft, NeatChatPicture } from './types';
import { HeardOrigin } from './voice/heard-origin';
import { boxOf, recordingContext } from './voice/listening.testing';
import { fakeMicDeps, flush } from './voice/media.testing';
import { MIC_DEPS } from './voice/mic-deps';

@Component({
  imports: [NeatMessageBox],
  template: `<neat-message-box
    [activity]="activity()"
    [maxPictures]="maxPictures()"
    [glow]="glow()"
    [glowTurnMs]="glowTurnMs()"
    [(text)]="text"
    [(pictures)]="pictures"
    [talk]="talk()"
    [camera]="camera()"
    [disabled]="disabled()"
    [transcribing]="transcribing()"
    [listeningMotion]="listeningMotion()"
    [(recording)]="recording"
    (recorded)="recordings.push($event)"
    (send)="sent.push($event)"
    (stop)="stops = stops + 1"
  />`,
})
class Host {
  readonly activity = signal<NeatMessageBoxActivity>('idle');
  readonly maxPictures = signal(4);
  readonly glow = signal<NeatMessageBoxGlow>('comet');
  readonly glowTurnMs = signal(2400);
  readonly text = signal('');
  readonly pictures = signal<readonly NeatChatPicture[]>([]);
  readonly talk = signal(false);
  readonly camera = signal(false);
  readonly disabled = signal(false);
  readonly transcribing = signal(false);
  readonly listeningMotion = signal<NeatListeningMotion>('level');
  readonly recording = signal(false);
  readonly recordings: Blob[] = [];
  readonly sent: NeatChatDraft[] = [];
  stops = 0;
}

function image(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

/** A dialog service whose dialogs close at once with what the spec says the camera took. */
const photo: { next: NeatChatPicture | undefined } = { next: undefined };
const fakeDialogs = { open: vi.fn(() => ({ closed: Promise.resolve(photo.next) })) };

function render() {
  const mic = fakeMicDeps();
  fakeDialogs.open.mockClear();
  TestBed.configureTestingModule({
    providers: [
      { provide: MIC_DEPS, useValue: mic.deps },
      { provide: CHAT_CLOCK, useValue: mic.clock },
      { provide: NeatDialog, useValue: fakeDialogs },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-message-box') as HTMLElement;
  const host = fixture.componentInstance;
  const area = () => element.querySelector('textarea') as HTMLTextAreaElement;
  const type = (text: string) => {
    area().value = text;
    area().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (init: KeyboardEventInit & { keyCode?: number }) => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init });
    if (init.keyCode !== undefined)
      Object.defineProperty(event, 'keyCode', { value: init.keyCode });
    area().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const drop = (files: File[]) => {
    const frame = element.querySelector('.frame') as HTMLElement;
    const event = new Event('drop', { cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { files, types: ['Files'] } });
    frame.dispatchEvent(event);
    fixture.detectChanges();
  };
  const sendButton = () => element.querySelector('button.send') as HTMLButtonElement;
  const talkButton = () =>
    element.querySelector('neat-push-to-talk button') as HTMLButtonElement | null;
  const press = (type: 'pointerdown' | 'pointerup') => {
    const event = new MouseEvent(type, { button: 0, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    talkButton()!.dispatchEvent(event);
    fixture.detectChanges();
  };
  const settle = async () => {
    await flush();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  /** Talk on, a recording granted and going. */
  const record = async (motion: NeatListeningMotion = 'level') => {
    host.talk.set(true);
    host.listeningMotion.set(motion);
    fixture.detectChanges();
    press('pointerdown');
    mic.mediaDevices.grant();
    await settle();
  };
  return {
    fixture,
    element,
    host,
    area,
    type,
    key,
    drop,
    sendButton,
    mic,
    talkButton,
    press,
    settle,
    record,
  };
}

describe('NeatMessageBox', () => {
  let revoked: string[];

  beforeEach(() => {
    revoked = [];
    let next = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => `blob:picture-${next++}`,
      revokeObjectURL: (url: string) => revoked.push(url),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Enter sends the draft and clears it', () => {
    const { host, type, key, area } = render();
    type('Hello board');
    const event = key({});
    expect(event.defaultPrevented).toBe(true);
    expect(host.sent).toEqual([{ text: 'Hello board', pictures: [] }]);
    expect(host.text()).toBe('');
    expect(area().value).toBe('');
  });

  it('Shift+Enter does not send', () => {
    const { host, type, key } = render();
    type('line one');
    const event = key({ shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(host.sent).toEqual([]);
  });

  it('Enter while composing does not send', () => {
    const { host, type, key } = render();
    type('にほん');
    key({ isComposing: true });
    key({ keyCode: 229 });
    expect(host.sent).toEqual([]);
  });

  it('an empty draft is not sent and Send is aria-disabled', () => {
    const { host, type, key, sendButton, fixture } = render();
    type('   ');
    expect(sendButton().getAttribute('aria-disabled')).toBe('true');
    key({});
    sendButton().click();
    fixture.detectChanges();
    expect(host.sent).toEqual([]);
    type('x');
    expect(sendButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('the Send button sends', () => {
    const { host, type, sendButton, fixture } = render();
    type('By button');
    sendButton().click();
    fixture.detectChanges();
    expect(host.sent).toEqual([{ text: 'By button', pictures: [] }]);
  });

  it('a draft of pictures alone is sent', () => {
    const { host, drop, key } = render();
    drop([image('shelf.png')]);
    key({});
    expect(host.sent).toHaveLength(1);
    expect(host.sent[0].text).toBe('');
    expect(host.sent[0].pictures.map((p) => p.name)).toEqual(['shelf.png']);
    expect(host.pictures()).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it('while not idle, Send is Stop and emits stop, and Enter does not send', () => {
    const { host, fixture, element, type, key } = render();
    host.activity.set('streaming');
    fixture.detectChanges();
    type('Next question');
    key({});
    expect(host.sent).toEqual([]);
    const stop = element.querySelector('button.stop') as HTMLButtonElement;
    expect(stop.getAttribute('aria-label')).toBe('Stop');
    expect(element.querySelector('button.send')).toBeNull();
    stop.click();
    expect(host.stops).toBe(1);
  });

  it('Send and Stop are one button, which keeps the focus as it changes', () => {
    const { host, fixture, element, type } = render();
    type('Hello');
    const button = element.querySelector('button.send') as HTMLButtonElement;
    button.focus();
    button.click();
    host.activity.set('waiting');
    fixture.detectChanges();
    expect(element.querySelector('button.stop')).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Stop');
    expect(document.activeElement).toBe(button);
    host.activity.set('idle');
    fixture.detectChanges();
    expect(element.querySelector('button.send')).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Send');
  });

  it('a dropped image is added, a dropped text file is not', () => {
    const { host, drop, element } = render();
    drop([image('a.png'), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(host.pictures().map((p) => p.name)).toEqual(['a.png']);
    expect(element.querySelector('img[alt="a.png"]')).not.toBeNull();
  });

  it('pictures from the Picture button are added', () => {
    const { host, element, fixture } = render();
    const input = element.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('image/*');
    Object.defineProperty(input, 'files', { value: [image('b.png')], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.pictures().map((p) => p.name)).toEqual(['b.png']);
  });

  it('pictures over maxPictures are not added and the status says so', () => {
    const { host, drop, element, fixture } = render();
    host.maxPictures.set(2);
    fixture.detectChanges();
    drop([image('1.png'), image('2.png'), image('3.png')]);
    expect(host.pictures().map((p) => p.name)).toEqual(['1.png', '2.png']);
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('Up to 2 pictures');
  });

  it('remove revokes and drops the picture', () => {
    const { host, drop, element, fixture } = render();
    drop([image('a.png'), image('b.png')]);
    const remove = element.querySelector('button[aria-label="Remove a.png"]') as HTMLButtonElement;
    remove.click();
    fixture.detectChanges();
    expect(host.pictures().map((p) => p.name)).toEqual(['b.png']);
    expect(revoked).toEqual(['blob:picture-0']);
  });

  it('data-activity follows activity', () => {
    const { host, fixture, element } = render();
    expect(element.getAttribute('data-activity')).toBe('idle');
    host.activity.set('waiting');
    fixture.detectChanges();
    expect(element.getAttribute('data-activity')).toBe('waiting');
    host.activity.set('streaming');
    fixture.detectChanges();
    expect(element.getAttribute('data-activity')).toBe('streaming');
  });

  it('glows with the comet by default, and not with glow none', () => {
    const { host, fixture, element } = render();
    expect(element.getAttribute('data-glow')).toBe('comet');
    host.glow.set('none');
    fixture.detectChanges();
    expect(element.hasAttribute('data-glow')).toBe(false);
  });

  it('data-glow is the chosen glow for each of NEAT_MESSAGE_BOX_GLOWS', () => {
    const { host, fixture, element } = render();
    for (const glow of NEAT_MESSAGE_BOX_GLOWS) {
      host.glow.set(glow);
      fixture.detectChanges();
      expect(element.getAttribute('data-glow')).toBe(glow);
    }
  });

  it('NEAT_MESSAGE_BOX_GLOWS lists comet first', () => {
    expect(NEAT_MESSAGE_BOX_GLOWS).toEqual(['comet', 'ring', 'aurora', 'sheen']);
  });

  it('glowTurnMs sets --neat-glow-turn in ms', () => {
    const { host, fixture, element } = render();
    expect(element.style.getPropertyValue('--neat-glow-turn')).toBe('2400ms');
    host.glowTurnMs.set(1800);
    fixture.detectChanges();
    expect(element.style.getPropertyValue('--neat-glow-turn')).toBe('1800ms');
  });

  it('the text area is named by label', () => {
    const { area } = render();
    expect(area().getAttribute('aria-label')).toBe('Message');
    expect(area().getAttribute('placeholder')).toBe('Ask something…');
  });

  describe('push-to-talk in the box', () => {
    it('talk shows push-to-talk before Send, and none without it', () => {
      const { element, host, fixture } = render();
      expect(element.querySelector('neat-push-to-talk')).toBeNull();
      host.talk.set(true);
      fixture.detectChanges();
      const talk = element.querySelector('neat-push-to-talk')!;
      expect(talk.hasAttribute('data-in-box')).toBe(true);
      const row = [...element.querySelector('.row')!.children];
      expect(row.indexOf(talk)).toBe(row.indexOf(element.querySelector('button.send')!) - 1);
    });

    it('a recording in the box is emitted as recorded', async () => {
      const t = render();
      await t.record();
      t.mic.advance(1000);
      t.press('pointerup');
      await t.settle();
      expect(t.host.recordings).toHaveLength(1);
    });

    it('a spoken question leaves the typed draft in the box', async () => {
      const t = render();
      t.type('typed');
      await t.record();
      t.mic.advance(1000);
      t.press('pointerup');
      await t.settle();
      expect(t.host.text()).toBe('typed');
      expect(t.host.sent).toEqual([]);
    });

    it('recording and transcribing reach its push-to-talk both ways', async () => {
      const t = render();
      t.host.talk.set(true);
      t.fixture.detectChanges();
      t.host.recording.set(true);
      t.fixture.detectChanges();
      expect(t.mic.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      t.mic.mediaDevices.grant();
      await t.settle();
      t.mic.advance(1000);
      t.press('pointerdown');
      await t.settle();
      expect(t.host.recording()).toBe(false);
      t.host.transcribing.set(true);
      t.fixture.detectChanges();
      expect(t.element.querySelector('neat-push-to-talk')!.getAttribute('data-state')).toBe(
        'transcribing',
      );
    });

    it('in-message-box lays the waveform over the text area, which keeps its size and stays in the accessibility tree', async () => {
      const t = render();
      await t.record('in-message-box');
      const canvas = t.element.querySelector('canvas.listening')!;
      expect(canvas).not.toBeNull();
      expect(canvas.getAttribute('aria-hidden')).toBe('true');
      expect(t.area().classList).toContain('listening');
      expect(t.area().hidden).toBe(false);
      expect(t.area().getAttribute('aria-hidden')).toBeNull();
      expect(t.element.querySelector('neat-push-to-talk neat-level-meter')).toBeNull();
      expect(
        t.element.querySelector('neat-push-to-talk .wave, neat-push-to-talk canvas'),
      ).toBeNull();
    });

    it('the waveform stays collapsed while transcribing and goes after', async () => {
      const t = render();
      await t.record('in-message-box');
      const canvas = t.element.querySelector('canvas') as HTMLCanvasElement;
      boxOf(canvas, 40, 30);
      recordingContext(canvas);
      t.mic.clock.frame(16);
      t.mic.advance(1000);
      t.press('pointerup');
      await t.settle();
      t.host.transcribing.set(true);
      t.fixture.detectChanges();
      t.mic.clock.frame(400);
      await t.settle();
      expect(t.element.querySelector('canvas.listening')).not.toBeNull();
      expect(t.mic.clock.pending()).toBe(false);
      t.host.transcribing.set(false);
      t.fixture.detectChanges();
      await t.settle();
      expect(t.element.querySelector('canvas.listening')).toBeNull();
      expect(t.area().classList).not.toContain('listening');
    });

    it('the box notes its text area when an in-message-box recording ends', async () => {
      const t = render();
      await t.record('in-message-box');
      t.mic.advance(1000);
      t.press('pointerup');
      await t.settle();
      expect(TestBed.inject(HeardOrigin).take()).toBe(t.area());
    });

    it('a recording in another motion notes no origin', async () => {
      const t = render();
      await t.record('radial');
      t.mic.advance(1000);
      t.press('pointerup');
      await t.settle();
      expect(TestBed.inject(HeardOrigin).take()).toBeNull();
    });

    it('disabled while recording cancels', async () => {
      const t = render();
      await t.record();
      t.host.disabled.set(true);
      t.fixture.detectChanges();
      await t.settle();
      expect(t.mic.mediaDevices.streams[0].stopped()).toBe(true);
      expect(t.host.recording()).toBe(false);
      expect(t.host.recordings).toEqual([]);
    });
  });

  describe('the camera', () => {
    const cameraButton = (element: HTMLElement) =>
      [...element.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Camera',
      );

    it('camera shows the Camera button, and none without it', () => {
      const { element, host, fixture } = render();
      expect(cameraButton(element)).toBeUndefined();
      host.camera.set(true);
      fixture.detectChanges();
      const camera = cameraButton(element)!;
      expect(camera.querySelector('neat-icon')!.getAttribute('data-icon')).toBe('camera');
      const row = [...element.querySelector('.row')!.children];
      const picture = row.find((child) => child.textContent?.trim() === 'Picture')!;
      expect(row.indexOf(camera)).toBeGreaterThan(row.indexOf(picture));
    });

    it("the dialog's picture joins the draft", async () => {
      const { element, host, fixture } = render();
      host.camera.set(true);
      host.pictures.set([{ id: 'a', src: 'blob:a', name: 'a.png' }]);
      fixture.detectChanges();
      photo.next = { id: 'p', src: 'blob:p', name: 'Photo from the camera' };
      cameraButton(element)!.click();
      expect(fakeDialogs.open).toHaveBeenCalledWith(CameraDialog, {
        title: 'Take a picture',
        inputs: {},
      });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(host.pictures().map((picture) => picture.id)).toEqual(['a', 'p']);
      expect(element.querySelectorAll('.thumb')).toHaveLength(2);
    });

    it('a canceled dialog adds nothing', async () => {
      const { element, host, fixture } = render();
      host.camera.set(true);
      fixture.detectChanges();
      photo.next = undefined;
      cameraButton(element)!.click();
      await fixture.whenStable();
      expect(host.pictures()).toEqual([]);
    });

    it('the Camera button waits while recording or when the draft is full', async () => {
      const t = render();
      t.host.camera.set(true);
      t.host.maxPictures.set(1);
      t.host.pictures.set([{ id: 'a', src: 'blob:a', name: 'a.png' }]);
      t.fixture.detectChanges();
      expect(cameraButton(t.element)!.getAttribute('aria-disabled')).toBe('true');
      cameraButton(t.element)!.click();
      t.fixture.detectChanges();
      expect(fakeDialogs.open).not.toHaveBeenCalled();
      expect(t.element.querySelector('.note')!.textContent).toBe('Up to 1 pictures');
      t.host.pictures.set([]);
      t.fixture.detectChanges();
      expect(cameraButton(t.element)!.getAttribute('aria-disabled')).toBeNull();
      await t.record();
      expect(cameraButton(t.element)!.getAttribute('aria-disabled')).toBe('true');
      cameraButton(t.element)!.click();
      expect(fakeDialogs.open).not.toHaveBeenCalled();
      t.host.disabled.set(true);
      t.fixture.detectChanges();
      await t.settle();
      expect(cameraButton(t.element)!.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
