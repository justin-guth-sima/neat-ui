import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatDropZone } from './drop-zone';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/** The variants on the zone's colour classes. */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  enabled: true,
  'focus-visible': 'focus',
  'data-drag-active': 'dragging',
};

const clip = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
const second = new File(['y'], 'second.MOV', { type: 'video/quicktime' });
const notes = new File(['z'], 'notes.txt', { type: 'text/plain' });

@Component({
  imports: [NeatDropZone],
  template: `
    <neat-drop-zone
      label="Drop videos here or click to choose"
      [multiple]="multiple()"
      [accept]="accept()"
      [disabled]="disabled()"
      (files)="received.push($event); order.push('files')"
      (rejected)="turnedAway.push($event); order.push('rejected')"
    />
  `,
})
class DropZoneHost {
  readonly multiple = signal(false);
  readonly accept = signal<string | undefined>(undefined);
  readonly disabled = signal(false);
  readonly received: File[][] = [];
  readonly turnedAway: File[][] = [];
  /** Which output fired, in order. */
  readonly order: string[] = [];
}

/** jsdom has no DataTransfer or DragEvent data, so a drag event carries the part the zone reads. */
function drag(type: string, files: File[] = [], kind: 'Files' | 'text/plain' = 'Files') {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files, types: [kind], dropEffect: 'none' },
  });
  return event as Event & { dataTransfer: { files: File[]; types: string[]; dropEffect: string } };
}

async function render(setup: (host: DropZoneHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(DropZoneHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement.querySelector('neat-drop-zone');
  const zone = root.querySelector<HTMLButtonElement>('button')!;
  const chooser = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { fixture, host: fixture.componentInstance, root, zone, chooser };
}

describe('NeatDropZone', () => {
  it('is one native button named by the visible label, so Enter and Space reach it like any button', async () => {
    const { root, zone } = await render();

    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(zone.type).toBe('button');
    expect(zone.textContent?.trim()).toBe('Drop videos here or click to choose');
    expect(zone.tabIndex).toBe(0);
  });

  it('keeps the file input out of the tab order and the accessibility tree: the button is the control', async () => {
    const { chooser } = await render();

    expect(chooser.hidden).toBe(true);
    expect(chooser.tabIndex).toBe(-1);
  });

  it('a click opens the file chooser; the keyboard gets there through the button’s own click on Enter and Space', async () => {
    const { zone, chooser } = await render();
    const open = vi.spyOn(chooser, 'click');

    zone.click();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('hands the chosen files to files and clears the input, so choosing the same file again counts', async () => {
    const { host, chooser } = await render();
    Object.defineProperty(chooser, 'files', { value: [clip], configurable: true });
    const reset = vi.fn();
    Object.defineProperty(chooser, 'value', { set: reset, get: () => 'C:\\fakepath\\clip.mp4' });

    chooser.dispatchEvent(new Event('change'));

    expect(host.received).toEqual([[clip]]);
    expect(reset).toHaveBeenCalledWith('');
  });

  it('multiple and accept go to the chooser as they are', async () => {
    const { fixture, host, chooser } = await render();
    expect(chooser.multiple).toBe(false);
    expect(chooser.hasAttribute('accept')).toBe(false);

    host.multiple.set(true);
    host.accept.set('video/*,.mkv');
    await fixture.whenStable();

    expect(chooser.multiple).toBe(true);
    expect(chooser.getAttribute('accept')).toBe('video/*,.mkv');
  });

  describe('dropping', () => {
    it('emits the dropped files', async () => {
      const { host, zone } = await render((host) => host.multiple.set(true));

      zone.dispatchEvent(drag('drop', [clip, second]));

      expect(host.received).toEqual([[clip, second]]);
    });

    it('allows the drop (dragover is cancelled, as a drop needs) and shows a copy cursor', async () => {
      const { zone } = await render();

      const over = drag('dragover', [clip]);
      zone.dispatchEvent(over);

      expect(over.defaultPrevented).toBe(true);
      expect(over.dataTransfer.dropEffect).toBe('copy');
    });

    it('takes only the first file unless multiple, and reports the others as rejected', async () => {
      const { host, zone } = await render();

      zone.dispatchEvent(drag('drop', [clip, second]));

      expect(host.received).toEqual([[clip]]);
      expect(host.turnedAway).toEqual([[second]]);
    });

    it('keeps only the files accept allows: by extension, case-insensitively, by MIME type and by type family', async () => {
      const { host, zone } = await render((host) => {
        host.multiple.set(true);
        host.accept.set('.mov, image/png, video/mp4');
      });
      const png = new File(['p'], 'frame.png', { type: 'image/png' });

      zone.dispatchEvent(drag('drop', [notes, clip, second, png]));
      expect(host.received).toEqual([[clip, second, png]]);
      expect(host.turnedAway).toEqual([[notes]]);
    });

    it('a drop with nothing acceptable emits rejected with every file and no files', async () => {
      const { host, zone } = await render((host) => {
        host.multiple.set(true);
        host.accept.set('video/*');
      });

      zone.dispatchEvent(drag('drop', [notes]));

      expect(host.received).toEqual([]);
      expect(host.turnedAway).toEqual([[notes]]);
    });

    it('emits rejected before files, and not at all when every file was taken', async () => {
      const { host, zone } = await render((host) => {
        host.multiple.set(true);
        host.accept.set('video/*');
      });

      zone.dispatchEvent(drag('drop', [notes, clip]));
      expect(host.order).toEqual(['rejected', 'files']);

      host.order.length = 0;
      host.turnedAway.length = 0;
      zone.dispatchEvent(drag('drop', [clip, second]));
      expect(host.order).toEqual(['files']);
      expect(host.turnedAway).toEqual([]);
    });

    it('a type family in accept matches every subtype', async () => {
      const { host, zone } = await render((host) => {
        host.multiple.set(true);
        host.accept.set('video/*');
      });

      zone.dispatchEvent(drag('drop', [notes, clip, second]));

      expect(host.received).toEqual([[clip, second]]);
    });

    it('trusts the chooser’s own accept: a chosen file the browser gives no type is taken', async () => {
      const { host, chooser } = await render((host) => host.accept.set('video/*,.mkv'));
      const untyped = new File(['t'], 'recording.ts', { type: '' });
      Object.defineProperty(chooser, 'files', { value: [untyped], configurable: true });

      chooser.dispatchEvent(new Event('change'));

      expect(host.received).toEqual([[untyped]]);
      expect(host.turnedAway).toEqual([]);
    });

    it('shows the drag state while files are over it, through children entering and leaving, and ends it on leave and on drop', async () => {
      const { fixture, root, zone } = await render();
      const active = () => zone.hasAttribute('data-drag-active');

      root.dispatchEvent(drag('dragenter', [clip]));
      await fixture.whenStable();
      expect(active()).toBe(true);

      // Entering the label's span fires dragenter on it before dragleave on the zone.
      zone.dispatchEvent(drag('dragenter', [clip]));
      root.dispatchEvent(drag('dragleave'));
      await fixture.whenStable();
      expect(active()).toBe(true);

      zone.dispatchEvent(drag('dragleave'));
      await fixture.whenStable();
      expect(active()).toBe(false);

      root.dispatchEvent(drag('dragenter', [clip]));
      root.dispatchEvent(drag('drop', [clip]));
      await fixture.whenStable();
      expect(active()).toBe(false);
    });

    it('does not react to something that is not a file being dragged over it', async () => {
      const { fixture, host, root, zone } = await render();

      root.dispatchEvent(drag('dragenter', [], 'text/plain'));
      const over = drag('dragover', [], 'text/plain');
      root.dispatchEvent(over);
      root.dispatchEvent(drag('drop', [], 'text/plain'));
      await fixture.whenStable();

      expect(zone.hasAttribute('data-drag-active')).toBe(false);
      expect(over.defaultPrevented).toBe(false);
      expect(host.received).toEqual([]);
      expect(host.turnedAway).toEqual([]);
    });
  });

  describe('disabled', () => {
    it('ignores clicks, drops and the chooser, and does not light up', async () => {
      const { fixture, host, root, zone, chooser } = await render((host) =>
        host.disabled.set(true),
      );
      const open = vi.spyOn(chooser, 'click');

      zone.click();
      root.dispatchEvent(drag('dragenter', [clip]));
      const over = drag('dragover', [clip]);
      root.dispatchEvent(over);
      root.dispatchEvent(drag('drop', [clip]));
      Object.defineProperty(chooser, 'files', { value: [clip], configurable: true });
      chooser.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(zone.disabled).toBe(true);
      expect(chooser.disabled).toBe(true);
      expect(open).not.toHaveBeenCalled();
      expect(zone.hasAttribute('data-drag-active')).toBe(false);
      expect(over.defaultPrevented).toBe(false);
      expect(host.received).toEqual([]);
      expect(host.turnedAway).toEqual([]);
    });

    it('works again once enabled', async () => {
      const { fixture, host, root } = await render((host) => host.disabled.set(true));

      host.disabled.set(false);
      await fixture.whenStable();
      root.dispatchEvent(drag('drop', [clip]));

      expect(host.received).toEqual([[clip]]);
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });

      it(`${scheme}: the dashed border reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, and the drag state's reaches it too`, async () => {
        const { zone } = await render();
        const classes = [...zone.classList];
        for (const state of [on(), on('dragging')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const border = stateColor(classes, 'border', q(state), under);
            expect(
              contrastRatio(border, under),
              `${scheme}, [${state.join(', ')}] border on --${surface}: ${border}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: the label reaches 4.5:1 at rest, hovered and while a drag is over it`, async () => {
        const { zone } = await render();
        const classes = [...zone.classList];
        for (const state of [on(), on('hover'), on('dragging')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor(classes, 'bg', q(state), under);
            const text = stateColor(classes, 'text', q(state), fill, tokens['foreground']);
            expect(
              contrastRatio(text, fill),
              `${scheme}, [${state.join(', ')}] text ${text} on ${fill} (--${surface})`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${scheme}: hovering or dragging over it tints the zone visibly (${MIN_FILL_CONTRAST}:1 or more) and the drag border differs from the resting one`, async () => {
        const { zone } = await render();
        const classes = [...zone.classList];
        for (const surface of SURFACES) {
          const under = tokens[surface];
          for (const state of [on('hover'), on('dragging')]) {
            const tint = stateColor(classes, 'bg', q(state), under);
            expect(
              contrastRatio(tint, under),
              `${scheme}, [${state.join(', ')}] tint ${tint} on --${surface}`,
            ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
          }
          expect(stateColor(classes, 'border', q(on('dragging')), under)).not.toBe(
            stateColor(classes, 'border', q(on()), under),
          );
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { zone } = await render();
        const classes = [...zone.classList];
        expect(classes).toContain('focus-visible:ring-3');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(classes, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}: ${ring}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
