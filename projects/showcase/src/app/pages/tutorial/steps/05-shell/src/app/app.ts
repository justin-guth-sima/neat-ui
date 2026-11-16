import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';

@Component({
  selector: 'app-root',
  imports: [NeatShell, RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Streams', icon: 'streaming', path: '/streams' },
    { label: 'About', icon: 'info', path: '/about' },
  ];
}
