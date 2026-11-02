import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { DocsTopicList } from './docs-context';
import { TopicList } from './topic-list';

const LIST: DocsTopicList = {
  label: 'Components',
  categories: [
    {
      label: 'Actions',
      topics: [
        { label: 'Button', path: '/button' },
        { label: 'Tooltip', path: '/tooltip' },
      ],
    },
    {
      label: 'Charts',
      topics: [
        { label: 'Sparkline', path: '/sparkline' },
        { label: 'Time chart', path: '/time-chart' },
      ],
    },
    {
      label: 'Data',
      topics: [
        { label: 'Table', path: '/table' },
        { label: 'Chart card', path: '/chart-card' },
      ],
    },
  ],
};

/** The page each route opens: the list, as a column or collapsed. */
@Component({
  imports: [TopicList],
  template: `<app-topic-list [list]="list" [collapsible]="collapsed()" current="Time chart" />`,
})
class Host {
  protected readonly list = LIST;
  readonly collapsed = signal(false);
}

describe('TopicList', () => {
  let scrolled: Element[];

  async function open(collapsed = false) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          LIST.categories.flatMap((category) =>
            category.topics.map((topic) => ({ path: topic.path.slice(1), component: Host })),
          ),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const host = await harness.navigateByUrl('/time-chart', Host);
    host.collapsed.set(collapsed);
    await harness.fixture.whenStable();
    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  const headings = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('h2'), (heading) => heading.textContent?.trim());
  const links = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('nav a'), (link) => link.textContent?.trim());

  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.restoreAllMocks();
  });

  it('lists the topics under their headings, the open one marked as the current page', async () => {
    const { element } = await open();
    const nav = element.querySelector('nav') as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Components topics');
    expect(headings(element)).toEqual(['Actions', 'Charts', 'Data']);
    expect(
      Array.from(nav.querySelectorAll('a'), (link) => [
        link.textContent?.trim(),
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['Button', '/button'],
      ['Tooltip', '/tooltip'],
      ['Sparkline', '/sparkline'],
      ['Time chart', '/time-chart'],
      ['Table', '/table'],
      ['Chart card', '/chart-card'],
    ]);
    expect(
      Array.from(nav.querySelectorAll('[aria-current="page"]'), (link) => link.textContent?.trim()),
    ).toEqual(['Time chart']);
    // Each heading names the list of its topics.
    for (const list of Array.from(nav.querySelectorAll('ul'))) {
      const heading = element.querySelector(`[id="${list.getAttribute('aria-labelledby')}"]`);
      expect(heading?.tagName).toBe('H2');
    }
  });

  it('filters by a topic’s label or its heading’s, hiding a heading with none left', async () => {
    const { harness, element } = await open();
    const field = element.querySelector('input[neatInput]') as HTMLInputElement;
    expect(field.getAttribute('aria-label')).toBe('Filter components');

    field.value = 'chart';
    field.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    // "Charts" matches as a heading, so all its topics stay; Data keeps only its chart topic.
    expect(headings(element)).toEqual(['Charts', 'Data']);
    expect(links(element)).toEqual(['Sparkline', 'Time chart', 'Chart card']);

    field.value = '  TOOL ';
    field.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(headings(element)).toEqual(['Actions']);
    expect(links(element)).toEqual(['Tooltip']);
  });

  it('says so when the filter leaves no topic', async () => {
    const { harness, element } = await open();
    const field = element.querySelector('input') as HTMLInputElement;

    field.value = 'gauge';
    field.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(headings(element)).toEqual([]);
    const note = element.querySelector('nav p');
    expect(note?.textContent?.trim()).toBe('No topic matches “gauge”.');
  });

  it('scrolls its own box to the open topic, never the page around it', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('href') === '/time-chart' ? 900 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(28);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { element } = await open();
    const list = element.querySelector('app-topic-list') as HTMLElement;

    // Centred: 900 less half of what the box shows beside the link.
    expect(list.scrollTop).toBe(900 - (400 - 28) / 2);
    expect(scrolled).toEqual([]);
  });

  it('leaves its box where it is when the open topic is in view', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(28);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const { element } = await open();

    expect((element.querySelector('app-topic-list') as HTMLElement).scrollTop).toBe(0);
  });

  it('collapses into a section named after the group, the open topic its summary', async () => {
    const { harness, element } = await open(true);
    const collapsible = element.querySelector('neat-collapsible') as HTMLElement;
    const trigger = collapsible.querySelector('button') as HTMLButtonElement;

    expect(element.querySelector('app-topic-list')?.getAttribute('data-layout')).toBe(
      'collapsible',
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Components');
    expect(trigger.textContent).toContain('Time chart');
    expect(collapsible.querySelector('nav[aria-label="Components topics"]')).not.toBeNull();

    trigger.click();
    await harness.fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('is a column of its own beside the topic on a wide screen', async () => {
    const { element } = await open();

    expect(element.querySelector('app-topic-list')?.getAttribute('data-layout')).toBe('column');
    expect(element.querySelector('neat-collapsible')).toBeNull();
  });
});
