import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { NeatNote, NeatSwatch } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatTable } from '@sima/neat-ui/table';
import { type NeatTileFrame, NeatVideoTile } from '@sima/neat-ui/video';
import { TrackSource } from './track-source';

/** A row of the list: a track on screen. */
interface Track {
  readonly id: number;
  readonly label: string;
}

function sameTracks(a: readonly Track[], b: readonly Track[]): boolean {
  return a.length === b.length && a.every((track, i) => track.id === b[i].id);
}

/**
 * A list beside the tile names the tracks on screen, each with a swatch in its color on the video.
 *
 * The tile's `colorOf` gives the color its overlay draws an item in: here a track, by its id. The
 * template calls it. It reads signals, so a swatch shows as soon as the tile has drawn its track.
 *
 * The list comes from the tile's `frameListener`, so it follows the picture. It writes its signal
 * only when the tracks change. Watch a vehicle leave on the right: it comes back on the left as a
 * new track, in a color of its own.
 *
 * @animated
 */
@Component({
  selector: 'app-track-colors',
  imports: [NeatCard, NeatNote, NeatSwatch, NeatTable, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-track-colors.example.html',
  styleUrl: './track-colors.example.css',
})
export class TrackColors {
  protected readonly road = new TrackSource();
  protected readonly tracks = signal<readonly Track[]>([], { equal: sameTracks });
  protected readonly listTracks = ({ messages }: NeatTileFrame): void => {
    const found = messages.find(({ message }) => message.type === 'tracking');
    const tracks = (found?.message.data as { tracks?: readonly Track[] } | undefined)?.tracks;
    const rows = (tracks ?? []).map(({ id, label }) => ({ id, label }));
    this.tracks.set(rows.sort((a, b) => a.id - b.id));
  };

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.road.start(document));
    inject(DestroyRef).onDestroy(() => this.road.stop());
  }
}
