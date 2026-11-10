import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatPageNav, type NeatPageNavGroup } from './page-nav';
import { NeatViewport } from './viewport';
import navStyles from './page-nav.css' with { loader: 'text' };

const GROUPS: readonly NeatPageNavGroup[] = [
  {
    items: [{ label: 'Overview', path: '/overview' }],
  },
  {
    label: 'Charts',
    items: [
      { label: 'Sparkline', path: '/sparkline' },
      { label: 'Time chart', path: '/time-chart' },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Table', path: '/table' },
      { label: 'Chart card', path: '/chart-card' },
      { label: 'Card layouts', path: '/chart-card/layouts' },
    ],
  },
];

/** The page each route opens: the side list, named as an app names it. */
@Component({
  imports: [NeatPageNav],
  template: `<nav
    neatPageNav
    aria-label="Components"
    [groups]="groups"
    [filterLabel]="filter()"
  ></nav>`,
})
class Host {
  protected readonly groups = GROUPS;
  readonly filter = signal<string | undefined>('Filter components');
}

@Component({
  imports: [NeatPageNav],
  template: `<nav neatPageNav [groups]="groups"></nav>`,
})
class Unnamed {
  protected readonly groups = GROUPS;
}

describe('NeatPageNav', () => {
  let scrolled: Element[];
  const narrow = signal(false);

  async function open(url = '/time-chart') {
    TestBed.configureTestingModule({
      providers: [
        // One route for every URL, so the page, and the list in it, stays across navigations.
        provideRouter([{ path: '**', component: Host }]),
        { provide: NeatViewport, useValue: { narrow } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Host);
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return {
      harness,
      element,
      nav: element.querySelector('nav[neatPageNav]') as HTMLElement,
      host: harness.routeDebugElement!.componentInstance as Host,
    };
  }

  const headings = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('h2'), (heading) => heading.textContent?.trim());
  const links = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('a'), (link) => link.textContent?.trim());
  const current = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('[aria-current="page"]'), (link) =>
      link.textContent?.trim(),
    );

  async function type(harness: RouterTestingHarness, element: HTMLElement, text: string) {
    const field = element.querySelector('input') as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  }

  beforeEach(() => {
    narrow.set(false);
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.restoreAllMocks();
  });

  it('lists the links under their groups’ headings, in order, the open one the current page', async () => {
    const { element, nav } = await open();

    expect(nav.getAttribute('aria-label')).toBe('Components');
    expect(headings(element)).toEqual(['Charts', 'Data']);
    expect(
      Array.from(nav.querySelectorAll('a'), (link) => [
        link.textContent?.trim(),
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['Overview', '/overview'],
      ['Sparkline', '/sparkline'],
      ['Time chart', '/time-chart'],
      ['Table', '/table'],
      ['Chart card', '/chart-card'],
      ['Card layouts', '/chart-card/layouts'],
    ]);
    expect(current(element)).toEqual(['Time chart']);
    // Each heading names the list of its links; a group without a label has neither.
    const lists = Array.from(nav.querySelectorAll('ul'));
    expect(lists).toHaveLength(3);
    expect(lists[0].hasAttribute('aria-labelledby')).toBe(false);
    for (const list of lists.slice(1)) {
      const heading = nav.querySelector(`[id="${list.getAttribute('aria-labelledby')}"]`);
      expect(heading?.tagName).toBe('H2');
    }
  });

  it('keeps a link current on the routes under its path, whatever the query and fragment', async () => {
    const { harness, element } = await open('/time-chart?range=1h#zoom');
    expect(current(element)).toEqual(['Time chart']);

    await harness.navigateByUrl('/table/12');
    expect(current(element)).toEqual(['Table']);
  });

  it('marks the link with the longest matching path, so a nested link wins over its parent', async () => {
    const { harness, element } = await open('/chart-card');
    expect(current(element)).toEqual(['Chart card']);

    await harness.navigateByUrl('/chart-card/layouts');
    expect(current(element)).toEqual(['Card layouts']);
  });

  it('has no filter without a filterLabel', async () => {
    const { harness, element, host } = await open();
    host.filter.set(undefined);
    await harness.fixture.whenStable();

    expect(element.querySelector('input')).toBeNull();
  });

  it('filters the links by label, ignoring case, and keeps a heading while one of its links matches', async () => {
    const { harness, element } = await open();
    const field = element.querySelector('input') as HTMLInputElement;
    expect(field.type).toBe('search');
    expect(field.getAttribute('aria-label')).toBe('Filter components');
    expect(field.placeholder).toBe('Filter components');

    await type(harness, element, 'chart');
    // Only labels count: "Charts" as a heading keeps nothing of its own.
    expect(headings(element)).toEqual(['Charts', 'Data']);
    expect(links(element)).toEqual(['Time chart', 'Chart card']);

    await type(harness, element, '  TABLE ');
    expect(headings(element)).toEqual(['Data']);
    expect(links(element)).toEqual(['Table']);
  });

  it('says that nothing matches, with no heading left, when the filter keeps no link', async () => {
    const { harness, element } = await open();

    await type(harness, element, 'gauge');

    expect(headings(element)).toEqual([]);
    expect(element.querySelectorAll('ul')).toHaveLength(0);
    expect(element.querySelector('nav p')?.textContent?.trim()).toBe('Nothing matches');
  });

  /** Links 28 high, and the filter `filter` high above them. */
  const mockHeights = (filter = 0): void => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('filter') ? filter : 28;
    });
  };

  it('scrolls only its own box to an open link below its fold, never the page around it', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('href') === '/time-chart' ? 900 : 0;
    });
    mockHeights();
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { nav } = await open();

    // Centered: 900 less half of what the box shows beside the link.
    expect(nav.scrollTop).toBe(900 - (400 - 28) / 2);
    expect(scrolled).toEqual([]);
  });

  it('scrolls to the open link again after a navigation that leaves it out of view', async () => {
    let far = '/time-chart';
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('href') === far ? 900 : 0;
    });
    mockHeights();
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { harness, nav } = await open('/overview');
    expect(nav.scrollTop).toBe(0);

    far = '/table';
    await harness.navigateByUrl('/table');
    await harness.fixture.whenStable();

    expect(nav.scrollTop).toBe(900 - (400 - 28) / 2);
    expect(scrolled).toEqual([]);
  });

  it('counts a link under the sticky filter as out of view', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('href') === '/table' ? 300 : 40;
    });
    mockHeights(40);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { harness, nav } = await open('/overview');
    expect(nav.scrollTop).toBe(0);

    // The link is inside the box's top edge, but the 40px filter lies over it.
    nav.scrollTop = 280;
    await harness.navigateByUrl('/table');
    await harness.fixture.whenStable();

    // Centered in what shows below the filter.
    expect(nav.scrollTop).toBe(300 - 40 - (400 - 40 - 28) / 2);
  });

  it('leaves its box where it is when the open link is in view', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(100);
    mockHeights();
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { nav } = await open();

    expect(nav.scrollTop).toBe(0);
  });

  it('throws in dev mode when the landmark has no name', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Unnamed);

    await expect(fixture.whenStable()).rejects.toThrow(/aria-label/);
  });

  it('is a column of its own on a wide screen', async () => {
    const { nav } = await open();

    expect(nav.dataset['layout']).toBe('column');
    expect(nav.querySelector('button')).toBeNull();
  });

  describe('on a narrow screen', () => {
    beforeEach(() => narrow.set(true));

    it('collapses into a closed section named by the landmark, the open link its summary', async () => {
      const { nav } = await open();
      const trigger = nav.querySelector('button') as HTMLButtonElement;
      const content = document.getElementById(trigger.getAttribute('aria-controls')!)!;

      expect(nav.dataset['layout']).toBe('collapsible');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.textContent).toContain('Components');
      expect(trigger.textContent).toContain('Time chart');
      expect(nav.contains(content)).toBe(true);
      expect(content.hasAttribute('inert')).toBe(true);
      expect(content.querySelectorAll('a')).toHaveLength(6);
    });

    it('opens on a press, and closes with the focus on its button when a link is chosen', async () => {
      const { harness, nav } = await open();
      const trigger = nav.querySelector('button') as HTMLButtonElement;
      const content = document.getElementById(trigger.getAttribute('aria-controls')!)!;

      trigger.click();
      await harness.fixture.whenStable();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(content.hasAttribute('inert')).toBe(false);
      // The summary is for the closed section only.
      expect(trigger.textContent).not.toContain('Time chart');

      const table = content.querySelector('a[href="/table"]') as HTMLAnchorElement;
      table.focus();
      table.click();
      await harness.fixture.whenStable();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
      expect(trigger.textContent).toContain('Table');
    });

    it('scrolls its open list, not the page, to the open link', async () => {
      vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.getAttribute('href') === '/time-chart' ? 900 : 0;
      });
      mockHeights();
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
      const { harness, nav } = await open();
      const trigger = nav.querySelector('button') as HTMLButtonElement;
      const content = document.getElementById(trigger.getAttribute('aria-controls')!)!;

      trigger.click();
      await harness.fixture.whenStable();

      expect(content.scrollTop).toBe(900 - (400 - 28) / 2);
      expect(nav.scrollTop).toBe(0);
      expect(scrolled).toEqual([]);
    });
  });

  describe('look', () => {
    /** The declarations of the stylesheet's rule for `selector`, a rule of its own. */
    const rule = (selector: string): string | undefined =>
      new RegExp(
        `(?:^|\\}\\n\\n|\\*/\\n)${selector.replace(/[[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
      ).exec(navStyles)?.[1];

    it('scrolls the column on its own, divided from the body by a border', async () => {
      const column = rule(":host([data-layout='column'])");
      expect(column).toMatch(/overflow-y:\s*auto/);
      expect(column).toMatch(/border-inline-end:\s*1px solid var\(--border\)/);
    });

    it('keeps the filter at the top while the links scroll under it, in the surface’s fill', () => {
      const filter = rule('.filter');
      expect(filter).toMatch(/position:\s*sticky/);
      expect(filter).toMatch(/top:\s*0/);
      expect(filter).toMatch(/background:\s*var\(--neat-surface\)/);
    });

    it('draws the links muted, and the open one as the rail draws its current page', () => {
      expect(rule('a')).toMatch(/color:\s*var\(--muted-foreground\)/);
      expect(rule("a:hover,\na[aria-current='page']")).toMatch(/background:\s*var\(--accent\)/);
      expect(rule("a[aria-current='page']")).toMatch(/font-weight:\s*500/);
    });

    it('is the offset parent of its links wherever it scrolls them', () => {
      expect(rule(':host')).toMatch(/position:\s*relative/);
      expect(rule('.list')).toMatch(/position:\s*relative/);
    });
  });
});
