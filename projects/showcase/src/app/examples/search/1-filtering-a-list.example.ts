import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatSearch } from '@sima/neat-ui';

/**
 * A search field over a list of streams. The app filters by the field's `value` and says what is
 * left in `status`, which the field shows under itself and announces. The clear button, or
 * Escape, empties it.
 *
 * @gallery
 */
@Component({
  selector: 'app-filtering-a-list',
  imports: [NeatSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-filtering-a-list.example.html',
  styleUrl: './filtering-a-list.example.css',
})
export class FilteringAList {
  protected readonly query = signal('');
  private readonly streams = [
    { name: 'Front door', source: 'RTSP camera' },
    { name: 'Loading dock', source: 'RTSP camera' },
    { name: 'Parking lot', source: 'File' },
    { name: 'Lobby', source: 'Webcam' },
    { name: 'Yard', source: 'File' },
  ];

  protected readonly shown = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.streams.filter((stream) =>
      `${stream.name} ${stream.source}`.toLowerCase().includes(query),
    );
  });

  protected readonly status = computed(() => {
    const count = this.shown().length;
    if (count === 0) return 'Nothing matches';
    return count === 1 ? '1 stream' : `${count} streams`;
  });
}
