import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { provideNeatTitles } from './titles';

@Component({ template: 'page' })
class Page {}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Parent {}

describe('provideNeatTitles', () => {
  beforeEach(() => {
    // The document outlives each test; a title left from the last one must not pass for this one's.
    document.title = '';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'media', title: 'Media', component: Page },
          { path: 'untitled', component: Page },
          {
            path: 'stats',
            title: 'Stats',
            component: Parent,
            children: [
              { path: 'power', title: 'Power', component: Page },
              { path: 'plain', component: Page },
            ],
          },
        ]),
        provideNeatTitles('Neat Insight'),
      ],
    });
  });

  async function titleAt(url: string): Promise<string> {
    await TestBed.inject(Router).navigateByUrl(url);
    return TestBed.inject(Title).getTitle();
  }

  it('titles the document with the app name, then the route’s title', async () => {
    expect(await titleAt('/media')).toBe('Neat Insight · Media');
  });

  it('is the app name alone on a route without a title', async () => {
    expect(await titleAt('/untitled')).toBe('Neat Insight');
  });

  it('takes the deepest route’s title, else the nearest one above it', async () => {
    expect(await titleAt('/stats/power')).toBe('Neat Insight · Power');
    expect(await titleAt('/stats/plain')).toBe('Neat Insight · Stats');
  });
});
