import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { type DiagramTransform, ZOOM_LIMITS } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import {
  EdgeLabelHtmlTemplateDirective,
  EdgeTemplateDirective,
  GroupNodeTemplateDirective,
  HandleComponent,
  NodeHtmlTemplateDirective,
  type Optimization,
  VflowComponent,
} from 'ngx-vflow';
import { BenchDiagramContext } from './bench-diagram-context';
import { BenchLoad, feedMessages } from './bench-load';
import { BenchNote, NOTE_BOX } from './bench-note';
import { startTransform } from './scene';
import { vflowGraph } from './vflow-graph';

/** The Autoware demo's setting: frames in a layer behind the edges. No virtualization. */
const OPTIMIZATION: Optimization = { detachedGroupsLayer: true };

/**
 * The fallback (design 3.1, `vflow`): ngx-vflow set up as the Autoware demo used it, drawing the
 * kit's scene (vflow-graph.ts): frames as SVG group templates, blocks and notes as HTML templates
 * with the kit block's and note's paint (vflow-host.css), each edge on the kit's route in its
 * colour, line and tips (bound from the scene, not from vflow's path, which waits for vflow to
 * measure the handles), and labels in vflow's HTML label template. The kit's own dot layer draws
 * over it, through `BenchDiagramContext` fed from vflow's viewport, so the dots cost the same on
 * both sides by construction.
 *
 * It starts at the kit's fit for its box (`startTransform`), set through `viewportTo` once vflow
 * is ready, so both hosts start from the same transform (design 2.3); vflow's own `fitView`
 * frames its nodes by another rule. A block's and a note's content carries its size, as the
 * demo's did: vflow sizes an HTML node by what it holds. Each node has one source and one target
 * handle, invisible: vflow draws an edge only between handles, and the routes ignore where they
 * are.
 */
@Component({
  selector: 'bench-vflow-host',
  imports: [
    BenchDiagramContext,
    BenchNote,
    EdgeLabelHtmlTemplateDirective,
    EdgeTemplateDirective,
    GroupNodeTemplateDirective,
    HandleComponent,
    NeatDiagramMessages,
    NeatStatusChip,
    NodeHtmlTemplateDirective,
    VflowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./host.css', './vflow-host.css'],
  template: `
    @let scene = load.scene();
    <div
      #box
      class="box"
      benchDiagramContext
      [level]="scene.level"
      [covers]="scene.covers"
      [edgeIds]="scene.edgeIds"
      [viewTransform]="view()"
    >
      <vflow
        view="auto"
        [nodes]="graph().nodes"
        [edges]="graph().edges"
        background="transparent"
        [entitiesSelectable]="false"
        [optimization]="OPTIMIZATION"
        [minZoom]="ZOOM_LIMITS[0]"
        [maxZoom]="ZOOM_LIMITS[1]"
      >
        <ng-template let-ctx groupNode>
          <svg:rect class="frame" [attr.width]="ctx.width() - 1" [attr.height]="ctx.height() - 1" />
          <svg:text class="title" x="13" y="24">{{ ctx.data().node.label }}</svg:text>
        </ng-template>

        <ng-template let-ctx nodeHtml>
          @let part = ctx.data();
          @if (part.kind === 'note') {
            <div
              class="note"
              [attr.data-note]="part.note.id"
              [style.width.px]="NOTE_BOX.w"
              [style.height.px]="NOTE_BOX.h"
            >
              <bench-note [edge]="part.edge" [rate]="messages.rate(part.edge)()" />
              <handle type="source" position="top" [template]="null" />
            </div>
          } @else {
            <div
              class="block"
              [attr.data-node]="part.node.id"
              [style.width.px]="part.node.w"
              [style.height.px]="part.node.h"
            >
              <span class="text">
                <span class="label">{{ part.node.label }}</span>
                @if (part.node.detail) {
                  <span class="detail">{{ part.node.detail }}</span>
                }
              </span>
              @for (chip of part.node.chips ?? []; track $index) {
                <neat-status-chip [tone]="chip.tone" variant="tinted">{{
                  chip.label
                }}</neat-status-chip>
              }
              <handle type="target" position="left" [template]="null" />
              <handle type="source" position="right" [template]="null" />
            </div>
          }
        </ng-template>

        <ng-template let-ctx edge>
          @let line = ctx.data();
          @if (line.kind === 'edge') {
            <svg:g
              class="edge"
              [attr.data-edge]="line.edge.id"
              [attr.data-line]="line.edge.line"
              [style.--edge]="line.edge.colour"
            >
              <svg:path class="hit" [attr.d]="line.edge.path" />
              <svg:path class="line" [attr.d]="line.edge.path" />
              @for (tip of line.edge.tips; track tip.end) {
                @if (tip.shape === 'arrow') {
                  <svg:path class="tip" [attr.d]="tip.d" />
                } @else {
                  <svg:circle class="tip" [attr.cx]="tip.cx" [attr.cy]="tip.cy" [attr.r]="tip.r" />
                }
              }
            </svg:g>
          } @else {
            <svg:g class="leader">
              <svg:line
                [attr.x1]="line.from.x"
                [attr.y1]="line.from.y"
                [attr.x2]="line.to.x"
                [attr.y2]="line.to.y"
              />
              <svg:circle [attr.cx]="line.from.x" [attr.cy]="line.from.y" r="2.5" />
            </svg:g>
          }
        </ng-template>

        <ng-template let-ctx edgeLabelHtml>
          <code class="edge-label">{{ ctx.label.data }}</code>
        </ng-template>
      </vflow>
      <neat-diagram-messages #messages />
    </div>
  `,
})
export class VflowHost {
  protected readonly load = inject(BenchLoad);
  protected readonly OPTIMIZATION = OPTIMIZATION;
  protected readonly ZOOM_LIMITS = ZOOM_LIMITS;
  protected readonly NOTE_BOX = NOTE_BOX;
  protected readonly graph = computed(() =>
    vflowGraph(this.load.synth().diagram.overview, this.load.scene()),
  );
  private readonly flow = viewChild(VflowComponent);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly messages = viewChild(NeatDiagramMessages);

  /** vflow's viewport as the dot layer reads a transform. */
  protected readonly view = computed((): DiagramTransform => {
    const viewport = this.flow()?.viewport() ?? { zoom: 1, x: 0, y: 0 };
    return { k: viewport.zoom, x: viewport.x, y: viewport.y };
  });

  constructor() {
    feedMessages(this.messages);
    // The kit's fit, once vflow is ready and for each new scene; a measured run's window keeps
    // its size, so a resize is not followed.
    afterRenderEffect(() => {
      const flow = this.flow();
      const scene = this.load.scene();
      if (!flow?.initialized()) return;
      untracked(() => {
        const { clientWidth: w, clientHeight: h } = this.box().nativeElement;
        const start = startTransform(scene, { w, h });
        if (start) flow.viewportTo({ zoom: start.k, x: start.x, y: start.y });
      });
    });
  }
}
