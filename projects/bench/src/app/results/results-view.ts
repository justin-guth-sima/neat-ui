import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatNote } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';
import { analyseCampaign, type CampaignAnalysis } from './analysis';
import { CampaignView } from './campaign-view';
import { type CampaignResult, parseCampaign } from './result-file';

/** One result file the page holds: what it says, and the numbers read from it once. */
interface Loaded {
  readonly id: number;
  readonly name: string;
  readonly campaign: CampaignResult;
  readonly analysis: CampaignAnalysis;
}

interface Problem {
  readonly name: string;
  readonly error: string;
}

const isImage = (file: File): boolean => file.type === 'image/png' || /\.png$/i.test(file.name);

/**
 * The results page (design 4.3, `/#/results`): drop one or more result files from
 * `projects/bench/results/`, and the screenshots beside them if the verdict should show them. The
 * files are read in the page and go nowhere, so it works on any machine that can open the bench.
 * Each result is a `bench-campaign-view`.
 */
@Component({
  selector: 'bench-results-view',
  imports: [CampaignView, NeatCallout, NeatDropZone, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './results-view.css',
  template: `
    <main>
      <h1>Results</h1>
      <neat-drop-zone
        label="Drop result files here, or click to choose them"
        accept=".json,application/json,.png,image/png"
        multiple
        (files)="take($event)"
        (rejected)="refuse($event)"
      />
      <p neatNote>
        Result files (<code>.json</code>) are in <code>projects/bench/results/</code>; drop a run's
        <code>.png</code> screenshots with them to see them in the verdict. Nothing leaves this
        page.
      </p>
      @for (problem of problems(); track $index) {
        <neat-callout tone="danger" [heading]="problem.name" announce="alert">
          {{ problem.error }}
        </neat-callout>
      }
      @for (item of loaded(); track item.id) {
        <bench-campaign-view
          [campaign]="item.campaign"
          [analysis]="item.analysis"
          [fileName]="item.name"
          [images]="images()"
          (remove)="remove(item.id)"
        />
      }
    </main>
  `,
})
export class ResultsView {
  protected readonly loaded = signal<readonly Loaded[]>([]);
  protected readonly problems = signal<readonly Problem[]>([]);
  protected readonly images = signal<ReadonlyMap<string, string>>(new Map());
  /** Files being read: how many are, so a spec (or a slow disk) can tell when they are done. */
  readonly pending = signal(0);

  private nextId = 0;
  private readonly urls = new Set<string>();

  constructor() {
    // The object URLs of the screenshots hold their files in memory until released.
    inject(DestroyRef).onDestroy(() => this.urls.forEach((url) => URL.revokeObjectURL(url)));
  }

  protected async take(files: File[]): Promise<void> {
    this.problems.set([]);
    this.pending.update((n) => n + files.length);
    const problems: Problem[] = [];
    for (const file of files) {
      try {
        if (isImage(file)) this.keepImage(file);
        else problems.push(...(await this.keepResult(file)));
      } finally {
        this.pending.update((n) => n - 1);
      }
    }
    this.problems.set(problems);
  }

  protected refuse(files: File[]): void {
    this.problems.update((all) => [
      ...all,
      ...files.map((file) => ({
        name: file.name,
        error: 'not a result (.json) or a screenshot (.png)',
      })),
    ]);
  }

  protected remove(id: number): void {
    this.loaded.update((all) => all.filter((item) => item.id !== id));
  }

  private keepImage(file: File): void {
    const url = URL.createObjectURL(file);
    this.urls.add(url);
    const old = this.images().get(file.name);
    if (old) {
      URL.revokeObjectURL(old);
      this.urls.delete(old);
    }
    this.images.update((all) => new Map(all).set(file.name, url));
  }

  /** Reads a result file; the problem with it, if it has one. */
  private async keepResult(file: File): Promise<Problem[]> {
    const parsed = parseCampaign(await file.text());
    if (!parsed.ok) return [{ name: file.name, error: parsed.error }];
    this.loaded.update((all) => [
      ...all,
      {
        id: this.nextId++,
        name: file.name,
        campaign: parsed.campaign,
        analysis: analyseCampaign(parsed.campaign),
      },
    ]);
    return [];
  }
}
