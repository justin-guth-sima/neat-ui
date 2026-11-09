import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DOT_FRAME_PROBE } from '@bench/diagram-seam';
import { App } from './app';
import { appConfig } from './app.config';
import { stubLayout } from './hosts/browser.testing';
import { DotProbeBuffer } from './measure/dot-probe';

/** Each route, the view it shows and its title. */
const VIEWS = [
  { path: '/kit', view: 'bench-kit-host', title: 'Kit' },
  { path: '/vflow', view: 'bench-vflow-host', title: 'vflow' },
  { path: '/none', view: 'bench-none-host', title: 'None' },
  { path: '/bev', view: 'bench-bev-host', title: "Bird's-eye view" },
  { path: '/results', view: 'bench-results-view', title: 'Results' },
];

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const heading = (): string | undefined =>
    (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent?.trim();

  async function navigate(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    stubLayout();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await navigate('/');
  });

  afterEach(() => {
    // The routed host goes first, so nothing it scheduled outlives the stand-ins.
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts on a page that links each renderer and the results', () => {
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'), (a) =>
      a.getAttribute('href'),
    );
    expect(heading()).toBe('neat-ui rendering bench');
    expect(links).toEqual(['#/kit', '#/vflow', '#/none', '#/bev', '#/results']);
  });

  it.each(VIEWS)('routes $path to its own view', async ({ path, view, title }) => {
    await navigate(path);

    expect((fixture.nativeElement as HTMLElement).querySelector(view)).not.toBeNull();
    expect(document.title).toBe(`neat-ui bench · ${title}`);
  });

  it('hands the dot layer the bench’s probe buffer as its frame probe', () => {
    expect(TestBed.inject(DOT_FRAME_PROBE)).toBe(TestBed.inject(DotProbeBuffer).record);
  });

  describe('the query string', () => {
    afterEach(() => {
      history.replaceState(null, '', '/');
      delete window.benchResult;
    });

    it('says why a run cannot start, on the page and where the harness reads the result', async () => {
      history.replaceState(null, '', '/?auto=1&ladder=Q');
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: appConfig.providers });
      fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Run failed');
      expect(text).toMatch(/ladder is one of/);
      expect(window.benchResult).toEqual({ error: expect.stringMatching(/ladder is one of/) });
    });

    it('shows no result panel on a page nobody asked a run of', () => {
      expect((fixture.nativeElement as HTMLElement).querySelector('neat-callout')).toBeNull();
      expect(window.benchResult).toBeUndefined();
    });
  });
});
