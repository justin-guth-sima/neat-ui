import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatProgress } from '@sima/neat-ui/progress';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';

type Shape = '16:9' | '1:1';

const SHAPES: NeatSegmentedOption<Shape>[] = [
  { value: '16:9', label: '16:9', icon: 'aspect-wide' },
  { value: '1:1', label: '1:1', icon: 'aspect-square' },
];
const SOURCES: NeatSelectOption<string>[] = [
  { value: 'camera', label: 'Front camera' },
  { value: 'clip', label: 'Warehouse clip' },
  { value: 'rtsp', label: 'RTSP stream' },
];

/**
 * The form controls on the card surface, which differs from the page's background in dark mode.
 * Look at each one's edge, track and fill there.
 *
 * A switch, a slider, a segmented control, an input and a select sit in a row. Two progress bars
 * and a drop zone sit in a column, then tabs.
 */
@Component({
  selector: 'app-controls-on-a-card',
  imports: [
    NeatDropZone,
    NeatInput,
    NeatProgress,
    NeatSegmented,
    NeatSelect,
    NeatSlider,
    NeatSwitch,
    NeatTab,
    NeatTabs,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-controls-on-a-card.example.html',
  styleUrl: './controls-on-a-card.example.css',
})
export class ControlsOnACard {
  protected readonly shapes = SHAPES;
  protected readonly sources = SOURCES;
  protected readonly bars = signal(true);
  protected readonly opacity = signal(60);
  protected readonly shape = signal<Shape>('16:9');
  protected readonly source = signal<string | null>(null);
  protected readonly tab = signal('metadata');
}
