import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { NeatIcon } from '@sima/neat-ui';

/*
 * The zone is a dashed outline in `--input`, the theme's form-control boundary, which is held to
 * 3:1 on every surface; hovering or dragging over it tints it with `--accent`, and a drag over it
 * also outlines it in `--primary`. The focus ring is the kit's, full `--ring`. Class strings stay
 * literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
const ZONE_CLASSES =
  'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input px-4 py-6 text-sm text-foreground outline-none transition-colors enabled:hover:bg-accent data-drag-active:border-primary data-drag-active:bg-accent focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/** Whether a drag carries files, as opposed to text or a link. */
function carriesFiles(event: Event): boolean {
  return (event as DragEvent).dataTransfer?.types.includes('Files') ?? false;
}

/**
 * Whether `file` is one `accept` allows, by the rules of the native `accept` attribute: a
 * comma-separated list of extensions (`.mkv`), exact MIME types (`video/mp4`) and type families
 * (`video/*`), compared without regard to case.
 */
function isAccepted(file: File, accept: string | undefined): boolean {
  const patterns = (accept ?? '')
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) =>
    pattern.startsWith('.')
      ? name.endsWith(pattern)
      : pattern.endsWith('/*')
        ? type.startsWith(pattern.slice(0, -1))
        : type === pattern,
  );
}

/**
 * A place to drop files, or to click for the system's file chooser:
 *
 * ```html
 * <neat-drop-zone label="Drop videos here or click to choose" accept="video/*" multiple
 *   (files)="upload($event)" />
 * ```
 *
 * `label` is the visible text and the accessible name. The zone is a native button: Tab focuses
 * it, Enter and Space (like a click) open the chooser. `files` emits the files that were dropped
 * or chosen, as one array per drop or choice. `multiple` allows several; without it, only the
 * first file is taken. `accept` is the native attribute's list (`video/*,.mkv`); the chooser
 * applies it itself, and the zone applies it to what is dropped, which the browser leaves
 * unfiltered. `rejected` emits the dropped files that were not taken (not allowed by `accept`,
 * or beyond the first without `multiple`), before `files` and even when `files` has nothing to
 * emit, so the app can say what it did not take. While `disabled` it does not react to clicks,
 * drags or drops.
 *
 * Files dragged over the zone light it up (`--primary` outline on an `--accent` tint). Only drags
 * that carry files do; text or a link dragged over it is ignored and the browser treats it as
 * anywhere else. The zone fills its container's width.
 *
 * The hidden file input is the chooser and stays out of the tab order and the accessibility tree:
 * the button is the control. Its value is cleared after each choice so that choosing the same file
 * again is a change.
 */
@Component({
  selector: 'neat-drop-zone',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(dragenter)': 'dragEnter($event)',
    '(dragover)': 'dragOver($event)',
    '(dragleave)': 'dragLeave($event)',
    '(drop)': 'drop($event)',
  },
  template: `
    <button
      type="button"
      data-slot="drop-zone"
      [class]="zoneClasses"
      [disabled]="disabled()"
      [attr.data-drag-active]="dragActive() ? '' : null"
      (click)="chooser.click()"
    >
      <neat-icon name="upload" [size]="20" />
      <span>{{ label() }}</span>
    </button>
    <input
      #chooser
      type="file"
      hidden
      tabindex="-1"
      [multiple]="multiple()"
      [attr.accept]="accept() ?? null"
      [disabled]="disabled()"
      (change)="chosen(chooser)"
    />
  `,
})
export class NeatDropZone {
  /** The visible text, and the accessible name. */
  readonly label = input.required<string>();
  /** Whether several files may be dropped or chosen at once. */
  readonly multiple = input(false, { transform: booleanAttribute });
  /** The kinds of file to take, as the native `accept` attribute has it. */
  readonly accept = input<string>();
  /** Turns the zone off: it takes neither a drop nor a click to choose files. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** The files that were dropped or chosen and taken, once per drop or choice. */
  readonly files = output<File[]>();
  /**
   * The dropped files that were left out, once per drop that left any out and before `files`:
   * those `accept` does not allow, and the ones after the first when `multiple` is off. An app
   * says why nothing (or not everything) was taken from this. Emitted even when `files` is not.
   */
  readonly rejected = output<File[]>();

  protected readonly zoneClasses: string = ZONE_CLASSES;
  protected readonly dragActive = signal(false);
  /**
   * How many elements of the zone the drag has entered and not left. Moving over the zone's own
   * children fires `dragenter` on the child before `dragleave` on the element it came from, so
   * the drag state ends when the count is back to zero, not at the first `dragleave`.
   */
  private entered = 0;

  protected dragEnter(event: Event): void {
    if (this.disabled() || !carriesFiles(event)) return;
    this.entered++;
    this.dragActive.set(true);
  }

  protected dragOver(event: Event): void {
    if (this.disabled() || !carriesFiles(event)) return;
    // A drop only happens on an element whose dragover was canceled.
    event.preventDefault();
    (event as DragEvent).dataTransfer!.dropEffect = 'copy';
  }

  protected dragLeave(event: Event): void {
    if (this.disabled() || !carriesFiles(event) || this.entered === 0) return;
    if (--this.entered === 0) this.dragActive.set(false);
  }

  protected drop(event: Event): void {
    this.entered = 0;
    this.dragActive.set(false);
    if (this.disabled() || !carriesFiles(event)) return;
    event.preventDefault();
    this.emit(Array.from((event as DragEvent).dataTransfer!.files), true);
  }

  protected chosen(chooser: HTMLInputElement): void {
    const files = Array.from(chooser.files ?? []);
    chooser.value = '';
    // The chooser has applied `accept` itself, with the system's idea of a file's type, which a
    // file's `type` in the browser can lack (an empty string for an extension with no MIME type).
    if (!this.disabled()) this.emit(files, false);
  }

  private emit(files: File[], filter: boolean): void {
    const allowed = filter ? files.filter((file) => isAccepted(file, this.accept())) : files;
    const kept = this.multiple() ? allowed : allowed.slice(0, 1);
    const rejected = files.filter((file) => !kept.includes(file));
    if (rejected.length > 0) this.rejected.emit(rejected);
    if (kept.length > 0) this.files.emit(kept);
  }
}
