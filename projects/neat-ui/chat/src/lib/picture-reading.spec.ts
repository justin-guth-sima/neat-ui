import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CHAT_CLOCK } from './chat-clock';
import { steppedFrames } from './chat.testing';
import { type NeatPictureMotion, PictureReading, tileGrid } from './picture-reading';
import readingStyles from './picture-reading.css' with { loader: 'text' };

@Component({
  imports: [PictureReading],
  template: `
    <span class="picture-frame">
      <img class="picture" src="blob:shelf" alt="shelf.jpg" />
      <neat-chat-picture-reading
        [motion]="motion()"
        src="blob:shelf"
        [answered]="answered()"
        [flight]="flight()"
        [target]="target"
        (done)="done = done + 1"
      />
    </span>
    <span class="orb"></span>
  `,
})
class Host {
  readonly motion = signal<Exclude<NeatPictureMotion, 'none'>>('coming-into-focus');
  readonly answered = signal(false);
  readonly flight = signal(false);
  done = 0;
  orb: HTMLElement | null = null;
  readonly target = () => this.orb;
}

/** A box jsdom does not lay out: `rect` relative to the viewport. */
function boxed(element: HTMLElement, rect: { left: number; top: number; w: number; h: number }) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, get: () => rect.w },
    clientHeight: { configurable: true, get: () => rect.h },
  });
  element.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.w,
      height: rect.h,
      right: rect.left + rect.w,
      bottom: rect.top + rect.h,
    }) as DOMRect;
}

/**
 * Runs `body` with the reading's host laid out `width` × `height`: jsdom lays nothing out, and the
 * reading measures its host as it begins. The sizes are Element's; these, on HTMLElement, shadow
 * them for the case and go after it.
 */
function laidOut(width: number, height: number, body: () => void): void {
  const size = (value: number) => ({
    configurable: true,
    get(this: HTMLElement) {
      return this.localName === 'neat-chat-picture-reading' ? value : 0;
    },
  });
  Object.defineProperties(HTMLElement.prototype, { clientWidth: size(width), clientHeight: size(height) });
  try {
    body();
  } finally {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  }
}

describe('PictureReading', () => {
  let clock: ReturnType<typeof steppedFrames>;

  beforeEach(() => {
    clock = steppedFrames();
    TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
  });

  /** Renders a reading of a 240 × 160 picture whose own size is 1200 × 800. */
  function render(motion: Exclude<NeatPictureMotion, 'none'>, flight = false) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.motion.set(motion);
    fixture.componentInstance.flight.set(flight);
    const root = fixture.nativeElement as HTMLElement;
    const orb = root.querySelector('.orb') as HTMLElement;
    fixture.componentInstance.orb = orb;
    const img = root.querySelector('img') as HTMLImageElement;
    Object.defineProperties(img, {
      naturalWidth: { configurable: true, get: () => 1200 },
      naturalHeight: { configurable: true, get: () => 800 },
    });
    fixture.detectChanges();
    const element = root.querySelector('neat-chat-picture-reading') as HTMLElement;
    boxed(element, { left: 100, top: 50, w: 240, h: 160 });
    boxed(orb, { left: 20, top: 400, w: 44, h: 44 });
    const tiles = () => [...element.querySelectorAll<HTMLElement>('.tile')];
    const count = (name: string) => tiles().filter((tile) => tile.classList.contains(name)).length;
    const answer = () => {
      fixture.componentInstance.answered.set(true);
      fixture.detectChanges();
    };
    return { fixture, element, orb, tiles, count, answer };
  }

  it('builds 140 tiles for a picture not laid out yet, and shows the picture in them', () => {
    const { element, tiles } = render('coming-into-focus');
    expect(tiles()).toHaveLength(140);
    expect(element.style.getPropertyValue('--picture')).toBe('url("blob:shelf")');
  });

  it('coming into focus marks tiles seen as the pace reveals them', () => {
    const { count } = render('coming-into-focus');
    expect(count('seen')).toBe(0);
    clock.frame(650);
    expect(count('seen')).toBe(70);
    clock.frame(650);
    expect(count('seen')).toBe(140);
    expect(count('hot')).toBe(0);
  });

  it('starts over while the board still reads, and finishes the round on the first word', () => {
    const { count, answer, element } = render('coming-into-focus');
    clock.frame(1300);
    expect(count('seen')).toBe(140);
    clock.frame(499);
    expect(count('seen')).toBe(140);
    clock.frame(1);
    expect(count('seen')).toBe(0);
    clock.frame(650);
    expect(count('seen')).toBe(70);
    answer();
    clock.frame(300);
    expect(count('seen')).toBe(140);
    clock.frame(450);
    expect(element.hasAttribute('data-ending')).toBe(true);
  });

  it("gives the tiles it makes the stage's style scope, so the component's styles reach them", () => {
    const { element, tiles } = render('coming-into-focus');
    const stage = element.querySelector('.stage')!;
    const scope = [...stage.attributes].map((a) => a.name).filter((n) => n.startsWith('_ngcontent'));
    expect(scope).toHaveLength(1);
    for (const tile of tiles()) expect(tile.hasAttribute(scope[0])).toBe(true);
  });

  it('cuts the picture into square tiles of whole pixels, about 140, its edge cutting the last ones', () => {
    // 240 × 160: tiles of 17 px, 15 across (255 px) and 10 down (170 px), the last cut off.
    expect(tileGrid(240, 160)).toEqual({ columns: 15, rows: 10, size: 17 });
    expect(tileGrid(160, 240)).toEqual({ columns: 10, rows: 15, size: 17 });
    expect(tileGrid(200, 200)).toEqual({ columns: 12, rows: 12, size: 17 });
    expect(tileGrid(800, 200)).toEqual({ columns: 24, rows: 6, size: 34 });
    // Not laid out (or not yet): the picture's usual 14 × 10, of no size.
    expect(tileGrid(0, 0)).toEqual({ columns: 14, rows: 10, size: 0 });
  });

  it('builds the grid for its box: each tile shows its own square of the picture, at its size', () => {
    laidOut(160, 240, () => {
      const { element, tiles } = render('coming-into-focus');
      expect(tiles()).toHaveLength(150);
      expect(element.style.getPropertyValue('--columns')).toBe('10');
      expect(element.style.getPropertyValue('--rows')).toBe('15');
      expect(element.style.getPropertyValue('--tile')).toBe('17px');
      expect(element.style.getPropertyValue('--picture-width')).toBe('160px');
      expect(element.style.getPropertyValue('--picture-height')).toBe('240px');
      expect(tiles()[0].style.backgroundPosition).toBe('0px 0px');
      // Row 1, column 1, and the last tile, row 14, column 9, overhanging the picture's corner.
      expect(tiles()[11].style.backgroundPosition).toBe('-17px -17px');
      expect(tiles()[149].style.backgroundPosition).toBe('-153px -238px');
    });
  });

  it('coming into focus lays the picture under its tiles in their unseen look, so no seam shows the page', () => {
    const { element } = render('coming-into-focus');
    expect(element.querySelector('.under')).not.toBeNull();
    const tile = readingStyles.match(/data-motion='coming-into-focus'\]\) \.tile \{([^}]*)\}/)?.[1] ?? '';
    const under = readingStyles.match(/data-motion='coming-into-focus'\]\) \.under \{([^}]*)\}/)?.[1] ?? '';
    const filter = (rule: string) => rule.match(/filter:[^;]*/)?.[0];
    expect(filter(under)).toBeDefined();
    expect(filter(under)).toBe(filter(tile));
  });

  it('beam and patches marks a tile hot for 160 ms, then seen', () => {
    const { element, count } = render('beam-and-patches');
    expect(element.querySelector('.beam')).not.toBeNull();
    expect(element.hasAttribute('data-reading')).toBe(true);
    clock.frame(100);
    expect(count('hot')).toBe(11);
    expect(count('seen')).toBe(0);
    clock.frame(159);
    expect(count('seen')).toBe(0);
    clock.frame(1);
    // The 11 tiles shown at 100 ms have cooled; those shown since are hot.
    expect(count('seen')).toBe(11);
    expect(count('hot')).toBe(28 - 11);
  });

  it("the viewfinder's label is inside the brackets and names the region in the picture's pixels", () => {
    const { element } = render('viewfinder');
    const finder = element.querySelector('.finder') as HTMLElement;
    const label = element.querySelector('.label') as HTMLElement;
    expect(finder.contains(label)).toBe(true);
    expect(element.querySelector('.dim')).not.toBeNull();
    const read = () => {
      const match = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(finder.style.transform)!;
      return { x: Number(match[1]), y: Number(match[2]) };
    };
    clock.frame(16);
    const first = read();
    expect(label.textContent).toBe(`${Math.round(first.x * 5)},${Math.round(first.y * 5)}`);
    // The region fits the picture: its width is 1/6 to 1/2 of it, its height 3/16 to 9/16.
    const corner = element.querySelectorAll<HTMLElement>('.corner')[3];
    const end = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(corner.style.transform)!;
    const w = Number(end[1]) + 12;
    const h = Number(end[2]) + 12;
    expect(w).toBeGreaterThanOrEqual(40);
    expect(w).toBeLessThanOrEqual(120);
    expect(h).toBeGreaterThanOrEqual(30);
    expect(h).toBeLessThanOrEqual(90);
    expect(first.x + w).toBeLessThanOrEqual(240);
    expect(first.y + h).toBeLessThanOrEqual(160);
    // It hops every 330 ms, not before.
    clock.frame(300);
    expect(read()).toEqual(first);
    clock.frame(30);
    expect(label.textContent).toBe(`${Math.round(read().x * 5)},${Math.round(read().y * 5)}`);
  });

  it('makes no patches to fly without flight', () => {
    const { element } = render('beam-and-patches');
    expect(element.querySelector('.fly')).toBeNull();
  });

  it('with flight, the tiles fly every third one revealed to the target, in any tile motion', () => {
    for (const motion of ['beam-and-patches', 'coming-into-focus'] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
      const { element } = render(motion, true);
      const flying = () => element.querySelectorAll('.fly[data-flying]');
      clock.frame(100);
      // Tiles 0 to 10 are shown: 0, 3, 6 and 9 send a patch.
      expect(flying(), motion).toHaveLength(4);
    }
  });

  it('with flight, the viewfinder sends a patch from each region it hops to', () => {
    const { element } = render('viewfinder', true);
    const flying = () => element.querySelectorAll('.fly[data-flying]');
    clock.frame(16);
    expect(flying()).toHaveLength(1);
    clock.frame(330);
    expect(flying()).toHaveLength(2);
  });

  it('with flight, a patch flies to the target and marks it hit', () => {
    const { element, orb } = render('beam-and-patches', true);
    expect(element.querySelector('.beam')).not.toBeNull();
    const flies = () => [...element.querySelectorAll<HTMLElement>('.fly')];
    expect(flies()).toHaveLength(24);
    const flying = () => flies().filter((fly) => fly.hasAttribute('data-flying'));
    clock.frame(100);
    // Tiles 0 to 10 are shown: 0, 3, 6 and 9 send a patch.
    expect(flying()).toHaveLength(4);
    // Each flies from its host's corner to the orb's center, less half its own 6 px.
    for (const fly of flying()) {
      expect(fly.style.transform).toBe('translate(-61px, 369px) scale(0.6)');
      expect(fly.style.opacity).toBe('0.2');
    }
    expect(orb.hasAttribute('data-hit')).toBe(false);
    clock.frame(560);
    expect(orb.hasAttribute('data-hit')).toBe(true);
  });

  it('emits done after the finish and its easing', () => {
    const { fixture, element, count, answer } = render('coming-into-focus');
    clock.frame(200);
    answer();
    clock.frame(300);
    expect(count('seen')).toBe(140);
    clock.frame(449);
    expect(element.hasAttribute('data-ending')).toBe(false);
    clock.frame(1);
    expect(element.hasAttribute('data-ending')).toBe(true);
    clock.frame(499);
    expect(fixture.componentInstance.done).toBe(0);
    clock.frame(1);
    expect(fixture.componentInstance.done).toBe(1);
    expect(clock.pending()).toBe(false);
  });

  it('the viewfinder lets go on the first word, then ends', () => {
    const { fixture, element, answer } = render('viewfinder');
    clock.frame(400);
    answer();
    clock.frame(16);
    expect(element.hasAttribute('data-reading')).toBe(false);
    clock.frame(320);
    expect(element.hasAttribute('data-ending')).toBe(true);
    clock.frame(500);
    expect(fixture.componentInstance.done).toBe(1);
  });

  it('runs no frames while the page is hidden, and goes on once it shows again', () => {
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    try {
      const { count } = render('coming-into-focus');
      hidden = true;
      clock.frame(100);
      expect(clock.pending()).toBe(false);
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(clock.pending()).toBe(true);
      clock.frame(550);
      expect(count('seen')).toBe(70);
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
  });

  it('stops its frames when destroyed', () => {
    const { fixture } = render('viewfinder');
    expect(clock.pending()).toBe(true);
    fixture.destroy();
    expect(clock.pending()).toBe(false);
  });
});
