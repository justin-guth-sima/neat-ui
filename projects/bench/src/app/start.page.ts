import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Where a person opening the bench by hand starts: a link to each renderer and the results. */
@Component({
  imports: [RouterLink],
  selector: 'bench-start-page',
  styleUrl: './start.page.css',
  template: `
    <main>
      <h1>neat-ui rendering bench</h1>
      <nav aria-label="Renderers">
        <ul>
          <li><a routerLink="/kit">Kit</a></li>
          <li><a routerLink="/vflow">vflow</a></li>
          <li><a routerLink="/none">None (the dots alone)</a></li>
          <li><a routerLink="/bev">Bird's-eye view (its own load, measured on opening)</a></li>
        </ul>
      </nav>
      <p><a routerLink="/results">Results</a></p>
    </main>
  `,
})
export class StartPage {}
