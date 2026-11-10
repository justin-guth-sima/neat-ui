import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatSegmented, type NeatSegmentedOption } from './segmented';

type Shape = 'wide' | 'square' | 'tall';

const OPTIONS: NeatSegmentedOption<Shape>[] = [
  { value: 'wide', label: '16:9', icon: 'aspect-wide' },
  { value: 'square', label: '1:1', icon: 'aspect-square' },
  { value: 'tall', label: '9:16' },
];
/** Labels too long for a narrow container, as Insight's source switch in a narrow side panel. */
const LONG_OPTIONS: NeatSegmentedOption<string>[] = [
  { value: 'file', label: 'File' },
  { value: 'camera', label: 'Camera' },
  { value: 'url', label: 'Stream URL' },
];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;
/**
 * How far the thumb's fill must stand from the track: a regression guard, below the 1.15:1 of a
 * fill on the page. In dark the chosen label (primary, 4.5:1 on the thumb) caps how light the fill
 * can be and the track must stay 1.15:1 from a card, which leaves about 1.1:1 between them; the
 * thumb's edge, not its fill, carries the definition there (see MIN_EDGE_CONTRAST).
 */
const MIN_THUMB_CONTRAST = 1.1;
/**
 * How far the thumb's hairline edge must stand from the track in dark, where the fill alone is
 * about 1.12:1 from it and a shadow does not show: 1.5:1 makes the thumb's outline read.
 */
const MIN_EDGE_CONTRAST = 1.5;

/**
 * The variants on the color classes of the track, the thumb and a segment. Disabled dims the whole
 * group (an opacity, not a color), so no segment color class has a disabled variant.
 */
const VOCABULARY = {
  dark: 'dark',
  'focus-visible': 'focus',
  'data-[state=on]': 'checked',
};

@Component({
  imports: [NeatSegmented],
  template: `
    <neat-segmented
      label="Tile shape"
      [options]="options"
      [disabled]="disabled()"
      [(value)]="shape"
      (valueChange)="changes.push($event)"
    />
  `,
})
class SegmentedHost {
  readonly options = OPTIONS;
  readonly shape = signal<Shape>('wide');
  readonly disabled = signal(false);
  readonly changes: Shape[] = [];
}

@Component({
  imports: [NeatSegmented],
  template: `<neat-segmented label="Source" [options]="options" value="url" />`,
})
class LongLabelsHost {
  readonly options = LONG_OPTIONS;
}

async function render(setup: (host: SegmentedHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(SegmentedHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const group = root.querySelector<HTMLElement>('[role="radiogroup"]')!;
  const radios = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  return { fixture, host: fixture.componentInstance, group, radios };
}

const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
/** A segment's accessible name: its text without what is hidden from assistive technology. */
const nameOf = (radio: HTMLElement) => {
  const copy = radio.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return copy.textContent?.replace(/\s+/g, ' ').trim();
};
const checked = (radios: HTMLElement[]) =>
  radios.map((radio) => radio.getAttribute('aria-checked'));
const tabStops = (radios: HTMLElement[]) => radios.map((radio) => radio.tabIndex);

describe('NeatSegmented', () => {
  it('is a radio group named by label, with one radio per option and no pressed state', async () => {
    const { group, radios } = await render();

    expect(group.getAttribute('aria-label')).toBe('Tile shape');
    expect(radios.map(nameOf)).toEqual(['16:9', '1:1', '9:16']);
    expect(checked(radios)).toEqual(['true', 'false', 'false']);
    for (const radio of radios) {
      expect(radio.type).toBe('button');
      expect(radio.hasAttribute('aria-pressed')).toBe(false);
    }
  });

  it('never takes a pressed state, after a click or an arrow key either', async () => {
    const { fixture, radios } = await render();
    const pressed = () => radios.map((radio) => radio.getAttribute('aria-pressed'));

    radios[1].click();
    await fixture.whenStable();
    expect(pressed()).toEqual([null, null, null]);
    expect(checked(radios)).toEqual(['false', 'true', 'false']);

    key(radios[1], 'ArrowRight');
    await fixture.whenStable();
    expect(pressed()).toEqual([null, null, null]);
    expect(checked(radios)).toEqual(['false', 'false', 'true']);
  });

  it('marks the checked segment with data-state for its styles', async () => {
    const { fixture, host, radios } = await render();
    expect(radios.map((radio) => radio.dataset['state'])).toEqual(['on', 'off', 'off']);

    host.shape.set('tall');
    await fixture.whenStable();
    expect(radios.map((radio) => radio.dataset['state'])).toEqual(['off', 'off', 'on']);
  });

  it('shows an option’s icon before its label, hidden from assistive technology', async () => {
    const { radios } = await render();

    const icon = radios[0].querySelector('neat-icon');
    expect(icon).not.toBeNull();
    // A neat-icon without a label is decorative: its svg is hidden from assistive technology.
    expect(icon?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(nameOf(radios[0])).toBe('16:9');
    expect(radios[2].querySelector('neat-icon')).toBeNull();
  });

  it('has one tab stop: the checked option, or the first when none is checked', async () => {
    const { fixture, host, radios } = await render();
    expect(tabStops(radios)).toEqual([0, -1, -1]);

    host.shape.set('square');
    await fixture.whenStable();
    expect(tabStops(radios)).toEqual([-1, 0, -1]);

    host.shape.set('none' as Shape);
    await fixture.whenStable();
    expect(checked(radios)).toEqual(['false', 'false', 'false']);
    expect(tabStops(radios)).toEqual([0, -1, -1]);
  });

  it('keyboard: arrows move focus and selection, wrapping; Home and End jump to the ends', async () => {
    const { fixture, host, radios } = await render();
    radios[0].focus();

    key(radios[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(document.activeElement).toBe(radios[1]);
    expect(tabStops(radios)).toEqual([-1, 0, -1]);

    key(radios[1], 'ArrowDown');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');

    key(radios[2], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');
    expect(document.activeElement).toBe(radios[0]);

    key(radios[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');

    key(radios[2], 'Home');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');

    key(radios[0], 'End');
    await fixture.whenStable();
    expect(host.shape()).toBe('tall');
    expect(document.activeElement).toBe(radios[2]);
    expect(host.changes).toEqual(['square', 'tall', 'wide', 'tall', 'wide', 'tall']);
  });

  it('a click checks an option; clicking the checked one keeps it checked', async () => {
    const { fixture, host, radios } = await render();

    radios[1].click();
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(checked(radios)).toEqual(['false', 'true', 'false']);

    radios[1].click();
    await fixture.whenStable();
    expect(host.shape()).toBe('square');
    expect(checked(radios)).toEqual(['false', 'true', 'false']);
    expect(host.changes).toEqual(['square']);
  });

  it('focus() focuses the selected segment, the control\u2019s tab stop', async () => {
    const { fixture, host, radios } = await render();
    const segmented: NeatSegmented<Shape> = fixture.debugElement.query(
      By.directive(NeatSegmented),
    ).componentInstance;

    segmented.focus();
    expect(document.activeElement).toBe(radios[0]);

    host.shape.set('tall');
    await fixture.whenStable();
    segmented.focus();
    expect(document.activeElement).toBe(radios[2]);
  });

  it('disabled disables every radio and ignores clicks and arrows', async () => {
    const { fixture, host, radios } = await render((host) => host.disabled.set(true));

    expect(radios.every((radio) => radio.disabled)).toBe(true);
    radios[1].click();
    key(radios[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.shape()).toBe('wide');
    expect(host.changes).toEqual([]);
  });

  describe('the iOS-style switch', () => {
    const thumbOf = (group: HTMLElement) =>
      group.querySelectorAll<HTMLElement>('[data-slot="segmented-thumb"]');
    const property = (group: HTMLElement, name: string) => group.style.getPropertyValue(name);

    it('draws one thumb, hidden from assistive technology, outside the radios', async () => {
      const { group, radios } = await render();

      const thumbs = thumbOf(group);
      expect(thumbs).toHaveLength(1);
      expect(thumbs[0].getAttribute('aria-hidden')).toBe('true');
      expect(radios.some((radio) => radio.contains(thumbs[0]))).toBe(false);
      expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    });

    it('positions the thumb from two custom properties on the group: count and chosen index', async () => {
      const { fixture, host, group } = await render();
      expect(property(group, '--neat-segmented-count')).toBe('3');
      expect(property(group, '--neat-segmented-index')).toBe('0');

      host.shape.set('tall');
      await fixture.whenStable();
      expect(property(group, '--neat-segmented-index')).toBe('2');
      expect(property(group, '--neat-segmented-count')).toBe('3');

      key(group.querySelectorAll<HTMLElement>('[role="radio"]')[2], 'ArrowLeft');
      await fixture.whenStable();
      expect(property(group, '--neat-segmented-index')).toBe('1');
    });

    it('sizes the thumb to one option and moves it by whole thumb widths, in pure CSS', async () => {
      const { group } = await render();
      const classes = [...thumbOf(group)[0].classList];

      expect(classes).toContain('w-[calc((100%-4px)/var(--neat-segmented-count))]');
      expect(classes).toContain('translate-x-[calc(var(--neat-segmented-index)*100%)]');
    });

    it('lays the options out as equal columns, so the thumb needs no measuring', async () => {
      const { group } = await render();

      expect([...group.classList]).toEqual(
        expect.arrayContaining(['inline-grid', 'grid-flow-col', 'p-0.5', 'isolate']),
      );
    });

    it('keeps its columns equal and lets them shrink: Tailwind\u2019s minmax(0, 1fr)', async () => {
      const { group } = await render();
      const classes = [...group.classList];

      // `auto-cols-fr` is `minmax(0, 1fr)`: as wide as the widest label times the count when there
      // is room, and narrower, still equal, when the container is narrower than that.
      expect(classes).toContain('auto-cols-fr');
      expect(classes.filter((name) => name.startsWith('auto-cols-'))).toHaveLength(1);
    });

    it('fills at most its container, and a flex row cannot squeeze it below its content', async () => {
      const { fixture } = await render();
      const host: HTMLElement = fixture.nativeElement.querySelector('neat-segmented');

      expect([...host.classList]).toEqual(
        expect.arrayContaining(['inline-flex', 'shrink-0', 'max-w-full']),
      );
    });

    it('clips a label that does not fit with an ellipsis, its whole text still the name', async () => {
      const fixture = TestBed.createComponent(LongLabelsHost);
      await fixture.whenStable();
      const radios = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]'),
      );
      expect(radios).toHaveLength(LONG_OPTIONS.length);

      for (const [index, radio] of radios.entries()) {
        const box = radio.querySelector<HTMLElement>('[data-slot="segmented-label"]')!;
        const [label, reserve] = Array.from(box.children) as HTMLElement[];
        // The label's box may shrink below its text (a flex item with no content minimum, one
        // column with a 0 minimum), and both the label and its semibold copy clip inside it.
        expect([...box.classList]).toEqual(expect.arrayContaining(['min-w-0', 'grid-cols-1']));
        expect(label.classList).toContain('truncate');
        expect(reserve.classList).toContain('truncate');
        expect(label.getAttribute('title')).toBe(LONG_OPTIONS[index].label);
        expect(nameOf(radio)).toBe(LONG_OPTIONS[index].label);
      }
    });

    it('is 32 px tall, the height of the small buttons: 28 px segments in a 2 px inset', async () => {
      const { group, radios } = await render();

      for (const radio of radios) {
        expect(radio.classList).toContain('h-7');
        expect(radio.classList).not.toContain('h-8');
      }
      expect(group.classList).toContain('p-0.5');
      // The thumb fills the segments' height, so it follows the inset and not a height of its own.
      const thumb = thumbOf(group)[0];
      expect(thumb.classList).toContain('inset-y-0.5');
      expect([...thumb.classList].some((name) => /^h-/.test(name))).toBe(false);
    });

    it('slides the thumb in 280 ms and not at all under reduced motion', async () => {
      const { group } = await render();
      const classes = [...thumbOf(group)[0].classList];

      expect(classes).toContain('transition-transform');
      expect(classes).toContain('duration-280');
      expect(classes).toContain('ease-[cubic-bezier(.3,.7,.2,1)]');
      expect(classes).toContain('motion-reduce:transition-none');
    });

    it('shows no thumb while no option is chosen', async () => {
      const { fixture, host, group } = await render();

      host.shape.set('none' as Shape);
      await fixture.whenStable();
      expect(thumbOf(group)).toHaveLength(0);

      host.shape.set('square');
      await fixture.whenStable();
      expect(thumbOf(group)).toHaveLength(1);
      expect(property(group, '--neat-segmented-index')).toBe('1');
    });

    it('the chosen segment is data-state on, a semibold primary label with no filled background', async () => {
      const { radios } = await render();
      const classes = [...radios[0].classList];

      expect(radios[0].dataset['state']).toBe('on');
      expect(classes).toContain('data-[state=on]:font-semibold');
      expect(classes).toContain('data-[state=on]:text-primary');
      expect(
        classes.filter((name) => /(^|:)bg-/.test(name) && !name.startsWith('before:')),
      ).toEqual(['bg-transparent']);
    });

    it('draws a divider before every segment but the first, hidden next to the chosen one', async () => {
      const { radios } = await render();
      const classes = [...radios[1].classList];

      expect(classes).toEqual(
        expect.arrayContaining([
          'before:absolute',
          'before:w-px',
          'first-of-type:before:hidden',
          'data-[state=on]:before:opacity-0',
          '[[data-state=on]+&]:before:opacity-0',
        ]),
      );
    });

    it('reserves the semibold width in every segment, outside the accessible name', async () => {
      const { fixture, host, radios } = await render();
      const reserve = (radio: HTMLElement) =>
        radio.querySelector<HTMLElement>('[data-slot="segmented-label-reserve"]')!;

      for (const [index, radio] of radios.entries()) {
        const copy = reserve(radio);
        expect(copy.textContent?.trim()).toBe(OPTIONS[index].label);
        expect(copy.getAttribute('aria-hidden')).toBe('true');
        expect([...copy.classList]).toEqual(expect.arrayContaining(['invisible', 'font-semibold']));
        // The visible label and the copy share one grid cell, so the cell is the wider of the two.
        expect(copy.parentElement!.classList).toContain('inline-grid');
        expect(copy.classList).toContain('col-start-1');
        expect(nameOf(radio)).toBe(OPTIONS[index].label);
      }

      host.shape.set('tall');
      await fixture.whenStable();
      expect(radios.map(nameOf)).toEqual(['16:9', '1:1', '9:16']);
    });

    it('dims the whole group when disabled, not each segment on top of it', async () => {
      const { group, radios } = await render((host) => host.disabled.set(true));

      expect(group.getAttribute('aria-disabled')).toBe('true');
      expect([...group.classList]).toContain('aria-disabled:opacity-50');
      expect(
        radios.some((radio) => [...radio.classList].some((name) => name.includes('opacity-50'))),
      ).toBe(false);
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      async function parts() {
        const { group, radios } = await render();
        const classesOf = (element: Element) => [...element.classList];
        return {
          group: classesOf(group),
          thumb: classesOf(group.querySelector('[data-slot="segmented-thumb"]')!),
          segment: classesOf(radios[0]),
        };
      }

      it(`${scheme}: the track shows (${MIN_FILL_CONTRAST}:1) on background and card`, async () => {
        const { group } = await parts();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const track = stateColor(group, 'bg', q(on()), under);
          expect(
            contrastRatio(track, under),
            `${scheme}, track ${track} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });

      it(`${scheme}: the thumb shows (${MIN_THUMB_CONTRAST}:1) on the track`, async () => {
        const { group, thumb } = await parts();
        const track = stateColor(group, 'bg', q(on()), tokens['background']);
        const fill = stateColor(thumb, 'bg', q(on()), track);
        expect(
          contrastRatio(fill, track),
          `${scheme}, thumb ${fill} on track ${track}`,
        ).toBeGreaterThanOrEqual(MIN_THUMB_CONTRAST);
      });

      it(`${scheme}: the thumb has a hairline edge${scheme === 'dark' ? ` ${MIN_EDGE_CONTRAST}:1 from the track` : ''}`, async () => {
        const { group, thumb } = await parts();
        expect(thumb).toContain('ring-1');
        const track = stateColor(group, 'bg', q(on()), tokens['background']);
        const edge = stateColor(thumb, 'ring', q(on()), track);
        expect(tokens['neat-segmented-thumb-edge'], 'the token exists').toBeDefined();
        expect(edge).toBe(tokens['neat-segmented-thumb-edge']);
        if (scheme === 'dark') {
          expect(
            contrastRatio(edge, track),
            `${scheme}, edge ${edge} on track ${track}`,
          ).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
        }
      });

      it(`${scheme}: labels reach 4.5:1, the unchosen on the track and the chosen on the thumb`, async () => {
        const { group, thumb, segment } = await parts();
        const track = stateColor(group, 'bg', q(on()), tokens['background']);
        const fill = stateColor(thumb, 'bg', q(on()), track);
        const unchosen = stateColor(segment, 'text', q(on()), track, tokens['foreground']);
        const chosen = stateColor(segment, 'text', q(on('checked')), fill, tokens['foreground']);
        expect(
          contrastRatio(unchosen, track),
          `${scheme}, unchosen ${unchosen} on ${track}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(chosen, fill),
          `${scheme}, chosen ${chosen} on ${fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { segment } = await parts();
        expect(segment).toContain('focus-visible:ring-[3px]');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(segment, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
