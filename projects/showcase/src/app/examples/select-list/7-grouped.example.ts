import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn, NeatSelectList, type NeatSelectListGroup } from '@sima/neat-ui/select-list';

/** A device, in scan order: the list groups the devices by kind. */
interface Device {
  readonly id: number;
  readonly name: string;
  readonly kind: 'camera' | 'microphone' | 'lidar';
  readonly connection: string;
}

const DEVICES: readonly Device[] = [
  { id: 1, name: 'IMX219', kind: 'camera', connection: 'MIPI CSI' },
  { id: 2, name: 'C920 microphone', kind: 'microphone', connection: 'USB' },
  { id: 3, name: 'Logitech C920', kind: 'camera', connection: 'USB 3.0' },
  { id: 4, name: 'Arducam USB', kind: 'camera', connection: 'USB 2.0' },
];

/** The groups, in order: the app writes each label, its count included. */
const GROUPS: readonly NeatSelectListGroup[] = [
  { key: 'camera', label: 'Cameras · 3' },
  { key: 'microphone', label: 'Microphones · 1' },
  { key: 'lidar', label: 'LiDAR · none found', muted: true },
];

/**
 * Devices under headings. The scan found them in a mixed order and the list sorts them into their
 * groups; LiDAR has none, so its muted heading stands alone. Press Down through the list: the
 * selection crosses the headings without stopping on one.
 */
@Component({
  selector: 'app-grouped',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <neat-select-list
        label="Devices"
        [items]="devices"
        [trackBy]="deviceId"
        [groups]="groups"
        [groupOf]="deviceKind"
        [(selected)]="selected"
      >
        <ng-template neatColumn="name" header="Device" let-device>{{ device.name }}</ng-template>
        <ng-template neatColumn="connection" header="Connection" width="6rem" let-device>{{
          device.connection
        }}</ng-template>
      </neat-select-list>
    </div>
  `,
  styleUrl: './grouped.example.css',
})
export class Grouped {
  protected readonly devices = DEVICES;
  protected readonly groups = GROUPS;
  protected readonly selected = signal<Device | null>(null);
  protected readonly deviceId = (device: Device) => device.id;
  protected readonly deviceKind = (device: Device) => device.kind;
}
