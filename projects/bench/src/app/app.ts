import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** The bench's root: only the routed view, since a measured page carries no chrome. */
@Component({
  imports: [RouterOutlet],
  selector: 'bench-root',
  template: '<router-outlet />',
})
export class App {}
