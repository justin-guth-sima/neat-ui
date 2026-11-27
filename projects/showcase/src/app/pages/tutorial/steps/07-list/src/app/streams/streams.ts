import { Component, signal } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { NeatBadge } from '@sima/neat-ui/badge';

export interface Stream {
  id: string;
  name: string;
  source: string;
  live: boolean;
}

const STREAMS: Stream[] = [
  { id: 'front-door', name: 'Front door', source: 'rtsp://camera-1/main', live: true },
  { id: 'loading-dock', name: 'Loading dock', source: 'rtsp://camera-2/main', live: true },
  { id: 'parking-lot', name: 'Parking lot', source: 'parking-lot.mp4', live: false },
  { id: 'lobby', name: 'Lobby', source: 'rtsp://camera-3/main', live: false },
  { id: 'yard', name: 'Yard', source: 'yard.mp4', live: true },
];

@Component({
  selector: 'app-streams',
  imports: [NeatColumn, NeatPage, NeatSelectList, NeatBadge],
  templateUrl: './streams.html',
  styleUrl: './streams.css',
})
export class Streams {
  protected readonly streams = signal(STREAMS);
  protected readonly selected = signal<Stream | null>(null);
  protected readonly streamId = (stream: Stream) => stream.id;
}
