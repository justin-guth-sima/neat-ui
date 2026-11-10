import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  NeatBev,
  type NeatBevObject,
  type NeatBevObjectId,
  type NeatBevPick,
  type NeatBevPoint,
} from '@sima/neat-ui/bev';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { streetFrames } from './scene';

/** A vehicle in the card's list: its track, as the view names it. */
interface Track {
  readonly id: string;
  readonly label: string;
}

/** A point around the vehicle in words: "12.3 m ahead, 4.1 m right". */
function place({ x, y }: NeatBevPoint): string {
  const m = (value: number) => `${Math.abs(value).toFixed(1)} m`;
  return `${m(x)} ${x >= 0 ? 'ahead' : 'behind'}, ${m(y)} ${y >= 0 ? 'left' : 'right'}`;
}

const VEHICLES = new Set(['car', 'truck', 'bicycle']);

/**
 * The view tells the app what happens on it, and the app can set what it highlights. The card
 * beside it reads `hovered` (the object under the pointer, by its id), `activated` (what a click
 * hit, and where) and `pointerMove` (where the pointer is, in meters). Its list of the vehicles
 * is bound to `hovered` both ways: hover a car in the view and its row is selected; select a row
 * and the view outlines that car and reads it out, until the pointer comes back over the view.
 * The objects carry their tracks' ids, so a car is the same car from frame to frame.
 */
@Component({
  selector: 'app-interaction',
  imports: [NeatBev, NeatCard, NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="interaction">
      <neat-bev
        [frame]="frame()"
        [range]="40"
        [(hovered)]="hovered"
        (activated)="picked.set($event)"
        (pointerMove)="pointer.set($event)"
      />
      <neat-card title="What the view reports" subtitle="And what the app sets">
        <dl class="report">
          <dt>Hovered</dt>
          <dd>{{ hoveredText() }}</dd>
          <dt>Last click</dt>
          <dd>{{ pickedText() }}</dd>
          <dt>Pointer</dt>
          <dd>{{ pointerText() }}</dd>
        </dl>
        <div class="tracks">
          <neat-select-list
            label="Vehicles"
            [items]="tracks"
            [trackBy]="trackId"
            [selected]="selectedTrack()"
            (selectedChange)="hovered.set($event?.id ?? null)"
          >
            <ng-template neatColumn="track" header="Vehicle" let-track>{{ track.id }}</ng-template>
            <ng-template neatColumn="distance" header="Distance" width="6rem" let-track>{{
              distanceText(track.id)
            }}</ng-template>
          </neat-select-list>
        </div>
      </neat-card>
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class Interaction {
  protected readonly frame = streetFrames();
  protected readonly hovered = signal<NeatBevObjectId | null>(null);
  protected readonly picked = signal<NeatBevPick | null>(null);
  protected readonly pointer = signal<NeatBevPoint | null>(null);

  /** The vehicles, once: the list's rows stay put while the scene moves. */
  protected readonly tracks: readonly Track[] = (this.frame().objects ?? [])
    .filter((object) => VEHICLES.has(object.label))
    .map((object) => ({ id: String(object.id), label: object.label }));
  protected readonly trackId = (track: Track) => track.id;

  /** This frame's objects by id. */
  private readonly objects = computed(
    () => new Map((this.frame().objects ?? []).map((object) => [object.id, object])),
  );

  protected readonly selectedTrack = computed(
    () => this.tracks.find((track) => track.id === this.hovered()) ?? null,
  );

  protected readonly hoveredText = computed(() => {
    const id = this.hovered();
    const object = id === null ? undefined : this.objects().get(id);
    return object ? `${object.id}, ${distance(object)}` : 'Nothing';
  });

  protected readonly pickedText = computed(() => {
    const pick = this.picked();
    if (!pick) return 'None yet';
    const what = pick.object ? String(pick.id) : 'Nothing';
    return `${what}, at ${place(pick)}`;
  });

  protected readonly pointerText = computed(() => {
    const point = this.pointer();
    return point ? place(point) : 'Not over the view';
  });

  protected distanceText(id: string): string {
    const object = this.objects().get(id);
    return object ? distance(object) : '';
  }
}

function distance(object: NeatBevObject): string {
  return `${Math.hypot(object.x, object.y).toFixed(1)} m`;
}
