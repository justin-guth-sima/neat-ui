import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

const VIEWS = [
  { path: '/kit', heading: 'Kit' },
  { path: '/vflow', heading: 'vflow' },
  { path: '/none', heading: 'None' },
  { path: '/results', heading: 'Results' },
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
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await navigate('/');
  });

  it('starts on a page that links each renderer and the results', () => {
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'), (a) =>
      a.getAttribute('href'),
    );
    expect(heading()).toBe('neat-ui rendering bench');
    expect(links).toEqual(['#/kit', '#/vflow', '#/none', '#/results']);
  });

  it.each(VIEWS)('routes $path to its own view', async ({ path, heading: expected }) => {
    await navigate(path);

    expect(heading()).toBe(expected);
    expect(document.title).toBe(`neat-ui bench · ${expected}`);
  });
});
