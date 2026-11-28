import { BROWSER_CLOCK, type FrameClock } from '../motion/eased';

/*
 * Keeps an expanded host over the region it covers (`NeatExpand`'s `region`): measuring, outside
 * change detection, with no Angular in it. Internal.
 *
 * The host is in the top layer, placed by `expand.css` from four custom properties this unit
 * writes on it (`--neat-expand-top`, `-left`, `-width` and `-height`, in the window's pixels), not
 * from inline `top`, `left`, `width` and `height`: those are the app's to set on its own element,
 * and writing them would lose the app's values when the host goes back.
 */

/** A border box in the window's coordinates, in CSS pixels. */
export interface RegionBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** What the tracker listens to and measures by: the browser's, or a spec's fakes. */
export interface RegionTrackerEnv {
  /** Where `resize` and `scroll` arrive: the window. */
  readonly events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** The frames a measurement waits for. */
  readonly frames: Pick<FrameClock, 'request' | 'cancel'>;
  readonly ResizeObserver: typeof ResizeObserver | undefined;
  readonly MutationObserver: typeof MutationObserver | undefined;
}

/**
 * The element's border box, or null where there is nothing to cover: out of the document, not
 * rendered (`display: none` leaves no box) or with no width or no height.
 */
export function regionBox(region: Element): RegionBox | null {
  if (!region.isConnected) return null;
  const { top, left, width, height } = region.getBoundingClientRect();
  return width > 0 && height > 0 ? { top, left, width, height } : null;
}

const SCROLL_OPTIONS = { capture: true, passive: true } as const;

/**
 * Places `host` over `region`'s border box at once, then follows it, at most one measurement a
 * frame, until the returned function stops it. What moves or resizes it: the size of the region
 * and of each element around it (a `ResizeObserver`, which also reports a region hidden), the
 * window's size, and a scroll of
 * anything (one capturing listener, since a scroll event does not bubble), such as a box that
 * scrolls the region. A change of the DOM anywhere (a `MutationObserver` on the document) checks
 * whether the region is still in it. `gone` is called, in a frame, once the region has left the
 * document or has nothing to cover; the tracker then stops measuring.
 *
 * The region must have a box when tracking starts (`regionBox`). Its rounded corners are read once,
 * so the host fits a card's shape (`--neat-expand-radius`).
 */
export function trackRegion(
  region: HTMLElement,
  host: HTMLElement,
  gone: () => void,
  env: RegionTrackerEnv = browserEnv(region),
): () => void {
  let placed: RegionBox | null = null;
  let frame: number | null = null;
  let stopped = false;

  const place = (box: RegionBox) => {
    const style = host.style;
    if (placed?.top !== box.top) style.setProperty('--neat-expand-top', `${box.top}px`);
    if (placed?.left !== box.left) style.setProperty('--neat-expand-left', `${box.left}px`);
    if (placed?.width !== box.width) style.setProperty('--neat-expand-width', `${box.width}px`);
    if (placed?.height !== box.height) style.setProperty('--neat-expand-height', `${box.height}px`);
    placed = box;
  };

  const measure = () => {
    frame = null;
    const box = regionBox(region);
    if (box === null) {
      stop();
      gone();
    } else {
      place(box);
    }
  };

  // Whatever arrives in a frame, the region is measured once, before the frame paints.
  const schedule = () => {
    if (frame === null && !stopped) frame = env.frames.request(measure);
  };

  const view = region.ownerDocument.defaultView;
  const radius = view?.getComputedStyle(region).borderRadius;
  host.style.setProperty('--neat-expand-radius', radius || '0');
  const box = regionBox(region);
  if (box !== null) place(box);

  const resizes = env.ResizeObserver ? new env.ResizeObserver(schedule) : null;
  // The region and every element around it: an ancestor that resizes moves a region of a fixed
  // size, such as a card in a content area the rail beside it narrows.
  for (let node: Element | null = region; node !== null && resizes; node = node.parentElement) {
    resizes.observe(node);
  }
  const mutations = env.MutationObserver ? new env.MutationObserver(schedule) : null;
  mutations?.observe(region.ownerDocument, { childList: true, subtree: true });
  env.events.addEventListener('resize', schedule);
  env.events.addEventListener('scroll', schedule, SCROLL_OPTIONS);

  function stop(): void {
    if (stopped) return;
    stopped = true;
    resizes?.disconnect();
    mutations?.disconnect();
    env.events.removeEventListener('resize', schedule);
    env.events.removeEventListener('scroll', schedule, { capture: true });
    if (frame !== null) env.frames.cancel(frame);
    frame = null;
  }

  return stop;
}

/** The browser's: the region's window, its observers and its frames. */
function browserEnv(region: Element): RegionTrackerEnv {
  const view = region.ownerDocument.defaultView;
  return {
    events: view ?? new EventTarget(),
    frames: BROWSER_CLOCK,
    ResizeObserver: typeof ResizeObserver === 'function' ? ResizeObserver : undefined,
    MutationObserver: typeof MutationObserver === 'function' ? MutationObserver : undefined,
  };
}

/** Removes the placement the tracker wrote on the host, once it goes back to its place. */
export function clearRegion(host: HTMLElement): void {
  for (const name of ['top', 'left', 'width', 'height', 'radius']) {
    host.style.removeProperty(`--neat-expand-${name}`);
  }
}
