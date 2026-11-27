import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  NeatDiagramFigureCard,
  NeatDiagramNoteTemplate,
  type NeatDiagramSet,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { A65, MLA } from './badges';

/** A camera feeding a detector and a tracker, with a note under each of the two. */
const TRACKING: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'camera', role: 'block', label: 'Camera', detail: 'USB', x: 0, y: 0, w: 120, h: 46 },
      {
        id: 'detector',
        role: 'block',
        label: 'Detector',
        badges: [MLA],
        x: 200,
        y: 0,
        w: 140,
        h: 46,
      },
      {
        id: 'tracker',
        role: 'block',
        label: 'Tracker',
        badges: [A65],
        x: 440,
        y: 0,
        w: 140,
        h: 46,
      },
    ],
    edges: [
      { id: 'camera-detector', from: 'camera', to: 'detector', series: 1 },
      { id: 'detector-tracker', from: 'detector', to: 'tracker', series: 4, label: 'boxes' },
    ],
    notes: [
      // A note's x and y are its center: each hangs below its block, its leader to the block's bottom.
      { id: 'benchmark', anchor: { x: 270, y: 46 }, x: 270, y: 130 },
      { id: 'tracks', anchor: { x: 510, y: 46 }, x: 510, y: 150 },
    ],
  },
};

/** How often the made-up feed sends new figures, in ms. */
const FEED_MS = 500;
/** How many of the recent counts the sparkline shows. */
const HISTORY = 30;

/**
 * A note shows a count or a time with `NeatDiagramFigureCard`: here the Tracker's active tracks,
 * with their recent counts, and the Detector's MLA benchmark, with a caption.
 *
 * A timer sends new figures twice a second. Each value eases to the next in tabular digits, so it
 * reads as moving rather than flickering.
 *
 * An edge's messages per second go in a `NeatDiagramRateCard` instead, which looks the same.
 */
@Component({
  selector: 'app-counts-and-times',
  imports: [NeatDiagramFigureCard, NeatDiagramNoteTemplate, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './10-counts-and-times.example.html',
  styleUrl: './counts-and-times.example.css',
})
export class CountsAndTimes {
  protected readonly tracking = TRACKING;
  /** The Tracker's active tracks. */
  protected readonly tracks = signal(5);
  /** The Tracker's recent counts, oldest first. */
  protected readonly trackHistory = signal<readonly number[]>([5]);
  /** The Detector's time per call on the MLA, in ms. */
  protected readonly benchmarkMs = signal(4.21);
  private readonly diagram = viewChild.required(NeatDiagramView);

  constructor() {
    const feed = setInterval(() => {
      // Now and then a track starts or ends, with between 2 and 9 alive.
      const tracks = Math.min(9, Math.max(2, this.tracks() + Math.round(Math.random() * 2 - 1)));
      this.tracks.set(tracks);
      this.trackHistory.update((counts) => [...counts, tracks].slice(-HISTORY));
      this.benchmarkMs.set(4.1 + Math.random() * 0.3);
    }, FEED_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(feed));
  }

  /** The calls per second that a time per call allows, as the caption says them. */
  protected callsPerSecond(ms: number): string {
    return `${Math.round(1000 / ms)} calls/s`;
  }

  /** Fits the drawing to its box again, as a toolbar's Fit button does. */
  fit(): void {
    this.diagram().fit();
  }
}
