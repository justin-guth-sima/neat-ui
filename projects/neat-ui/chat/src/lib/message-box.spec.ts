import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NEAT_MESSAGE_BOX_GLOWS,
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from './message-box';
import type { NeatChatDraft, NeatChatPicture } from './types';

@Component({
  imports: [NeatMessageBox],
  template: `<neat-message-box
    [activity]="activity()"
    [maxPictures]="maxPictures()"
    [glow]="glow()"
    [glowTurnMs]="glowTurnMs()"
    [(text)]="text"
    [(pictures)]="pictures"
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
  readonly sent: NeatChatDraft[] = [];
  stops = 0;
}

function image(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

function render() {
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
  return { fixture, element, host, area, type, key, drop, sendButton };
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
});
