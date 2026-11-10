import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { type NeatDiagramPart, type NeatDiagramPick, NeatDiagramView } from '@sima/neat-ui/diagram';
import { COMPILE_FLOW } from './compile-flow-data';

/** The overview's blocks, for the list beside the drawing. */
const BLOCKS = COMPILE_FLOW.overview.nodes
  .filter((node) => node.role === 'block')
  .map((node) => ({ id: node.id, label: node.label }));

/**
 * The app reads the diagram and sets it: `hovered` is the part in focus (the pointer's block or
 * edge, or the keyboard's block, or one the app sets), and `activated` reports a click on a block
 * or an edge. The list beside the drawing is bound to `hovered` both ways: point at a row (or tab to
 * it) and its block is in focus in the drawing, with what it is joined to; point at a block and
 * its row is marked. The card also says the last part clicked.
 */
@Component({
  selector: 'app-diagram-from-the-app',
  imports: [NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="beside">
      <neat-diagram
        class="diagram"
        [diagram]="flow"
        label="A compile flow, read from the app"
        highlight="all"
        [(hovered)]="hovered"
        (activated)="picked.set($event)"
      />
      <div class="report">
        <ul class="blocks" aria-label="Blocks">
          @for (block of blocks; track block.id) {
            <li>
              <button
                type="button"
                [attr.data-current]="isHovered(block.id) ? '' : null"
                (pointerenter)="show(block.id)"
                (pointerleave)="hovered.set(null)"
                (focus)="show(block.id)"
                (blur)="hovered.set(null)"
              >
                {{ block.label }}
              </button>
            </li>
          }
        </ul>
        <dl>
          <dt>Hovered</dt>
          <dd>{{ hoveredText() }}</dd>
          <dt>Last click</dt>
          <dd>{{ pickedText() }}</dd>
        </dl>
      </div>
    </div>
  `,
  styleUrls: ['./diagram-box.css', './from-the-app.example.css'],
})
export class DiagramFromTheApp {
  protected readonly flow = COMPILE_FLOW;
  protected readonly blocks = BLOCKS;
  protected readonly hovered = signal<NeatDiagramPart | null>(null);
  protected readonly picked = signal<NeatDiagramPick | null>(null);

  protected isHovered(id: string): boolean {
    const part = this.hovered();
    return part?.kind === 'block' && part.id === id;
  }

  /** Puts a block in focus in the drawing, as the pointer on it would. */
  protected show(id: string): void {
    this.hovered.set({ kind: 'block', id });
  }

  protected readonly hoveredText = computed(() => {
    const part = this.hovered();
    return part ? `${part.kind} ${part.id}` : 'Nothing';
  });

  protected readonly pickedText = computed(() => {
    const pick = this.picked();
    return pick ? `${pick.kind} ${pick.id}` : 'None yet';
  });
}
