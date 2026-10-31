import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { BenchHosts } from './hosts/bench-host';
import { installBenchGlobals } from './run/bench-globals';
import { autoParams } from './run/auto-params';
import { AutoRun } from './run/auto-run';

/**
 * The bench's root: the routed view, since a measured page carries no chrome, and the automatic
 * mode's start from the query (`?auto=1`, design 4.1). Its result panel appears when a run is
 * over, never during one: a signal that changes while frames are measured would put change
 * detection into them.
 */
@Component({
  imports: [NeatButton, NeatCallout, RouterOutlet],
  selector: 'bench-root',
  styleUrl: './app.css',
  template: `
    <router-outlet />
    @switch (auto.status()) {
      @case ('done') {
        <neat-callout class="result" tone="success" heading="Run complete" announce="status">
          {{ auto.message() }}
          @if (auto.download(); as file) {
            <a neatButton neatCalloutActions size="small" [href]="file.url" [download]="file.name">
              Download result
            </a>
          }
        </neat-callout>
      }
      @case ('failed') {
        <neat-callout class="result" tone="danger" heading="Run failed" announce="alert">
          {{ auto.message() }}
        </neat-callout>
      }
    }
  `,
})
export class App {
  protected readonly auto = inject(AutoRun);

  constructor() {
    installBenchGlobals(inject(BenchHosts));
    try {
      const params = autoParams(inject(DOCUMENT).location.search);
      if (params) void this.auto.start(params);
    } catch (error) {
      this.auto.fail(error instanceof Error ? error.message : String(error));
    }
  }
}
