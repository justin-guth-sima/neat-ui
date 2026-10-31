import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';
import { campaign, climb } from './results.testing';
import { ResultsView } from './results-view';

/** Both renderers, three repeats: the kit a step and a half behind, vflow past it. */
const FILE = JSON.stringify(
  campaign(
    [
      ...[0, 1, 2].flatMap((repeat) =>
        climb('kit', repeat, ['smooth', 'smooth', 'usable', 'failing']),
      ),
      ...[0, 1, 2].flatMap((repeat) =>
        climb('vflow', repeat, ['smooth', 'smooth', 'smooth', 'smooth', 'usable', 'failing']),
      ),
    ],
    { warnings: ['kit A r0: the CPU fell from 4800 MHz to 3600 MHz'] },
  ),
);

const json = (name: string, text: string): File =>
  new File([text], name, { type: 'application/json' });

describe('ResultsView', () => {
  let fixture: ComponentFixture<ResultsView>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';

  async function drop(...files: File[]): Promise<void> {
    fixture.debugElement.query(By.directive(NeatDropZone)).triggerEventHandler('files', files);
    // Reading a file is asynchronous; whenStable waits for the signals it sets.
    await vi.waitFor(() => expect(fixture.componentInstance.pending()).toBe(0));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(ResultsView);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for result files and shows no result before one is loaded', () => {
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Results');
    expect(root().querySelector('neat-drop-zone')).not.toBeNull();
    expect(root().querySelector('bench-campaign-view')).toBeNull();
  });

  it('shows a result’s capacities, verdict, warnings and not-comparable notes', async () => {
    await drop(json('result.json', FILE));

    const view = root().querySelector('bench-campaign-view')!;
    expect(view.querySelector('h2')?.textContent).toContain('rig');
    const rows = Array.from(view.querySelectorAll('table[aria-label^="Capacity"] tbody tr'), (tr) =>
      tr.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows[0]).toContain('A: diagram size');
    expect(rows[0]).toContain('kit');
    expect(rows[0]).toContain('×2 (60 blocks)');
    expect(rows[1]).toContain('vflow');
    expect(rows[1]).toContain('×8 (240 blocks)');
    const verdict = view.querySelector('[data-slot="verdict"]');
    expect(verdict?.textContent).toContain('Clearly slower');
    expect(verdict?.textContent).toContain('3 of 3');
    expect(view.textContent).toContain('the CPU fell from 4800 MHz to 3600 MHz');
    expect(view.textContent).toContain('Hover dimming exists only in the kit.');
  });

  it('shows each step’s phases of the renderer chosen', async () => {
    await drop(json('result.json', FILE));

    const view = root().querySelector('bench-campaign-view')!;
    expect(view.querySelectorAll('table[aria-label^="Steps"] tbody tr')).toHaveLength(6);
    const phases = view.querySelectorAll('table[aria-label^="Phases"] tbody tr');
    expect(phases).toHaveLength(4 * 4);
    expect(phases[0].textContent).toContain('idle');
  });

  it('says why a file is not a result, by its name, and keeps the ones that are', async () => {
    await drop(json('notes.json', '{"not":"a result"}'), json('result.json', FILE));

    expect(text()).toContain('notes.json');
    expect(text()).toMatch(/schema/);
    expect(root().querySelectorAll('bench-campaign-view')).toHaveLength(1);
  });

  it('says by name which file is no result when it is dropped with ones that are', async () => {
    const zone = fixture.debugElement.query(By.directive(NeatDropZone));
    // As the drop zone reports a drop of a result and a text file: refused first, in one task.
    zone.triggerEventHandler('rejected', [new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    zone.triggerEventHandler('files', [json('result.json', FILE)]);
    await vi.waitFor(() => expect(fixture.componentInstance.pending()).toBe(0));
    await fixture.whenStable();

    expect(text()).toContain('notes.txt');
    expect(root().querySelectorAll('bench-campaign-view')).toHaveLength(1);
  });

  it('forgets the problems of an earlier drop when the next one comes', async () => {
    await drop(json('notes.json', '{"not":"a result"}'));
    expect(text()).toContain('notes.json');

    await drop(json('result.json', FILE));

    expect(text()).not.toContain('notes.json');
  });

  it('names a file it cannot read, and goes on with the files after it', async () => {
    // Whatever throws while a file is read or laid out is that file's problem, not the page's.
    const unreadable = json('first.json', FILE);
    vi.spyOn(unreadable, 'text').mockRejectedValue(new TypeError('the disk went away'));

    await drop(unreadable, json('second.json', FILE));

    expect(text()).toContain('first.json');
    expect(text()).toContain('the disk went away');
    expect(root().querySelectorAll('bench-campaign-view')).toHaveLength(1);
  });

  it('keeps several results, each its own, and lets one go', async () => {
    await drop(json('a.json', FILE), json('b.json', FILE));
    expect(root().querySelectorAll('bench-campaign-view')).toHaveLength(2);

    const remove = root().querySelector<HTMLButtonElement>('button[data-remove]')!;
    remove.click();
    await fixture.whenStable();

    expect(root().querySelectorAll('bench-campaign-view')).toHaveLength(1);
  });

  it('copies the summary as markdown, and says it did', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await drop(json('result.json', FILE));

    const copy = Array.from(root().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy as markdown'),
    )!;
    copy.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    await fixture.whenStable();

    expect(writeText.mock.calls[0][0]).toContain('# Rendering bench: rig');
    expect(writeText.mock.calls[0][0]).toContain('## Capacity');
    expect(text()).toContain('Copied');
  });

  it('shows a screenshot dropped with the result where the result names it', async () => {
    const withShot = JSON.parse(FILE);
    withShot.runs = [
      { ladder: 'A', renderer: 'kit', repeat: 0, status: 'ok', screenshot: 'kit.png' },
      { ladder: 'A', renderer: 'vflow', repeat: 0, status: 'ok', screenshot: 'vflow.png' },
    ];
    vi.stubGlobal('URL', {
      createObjectURL: (file: File) => `blob:${file.name}`,
      revokeObjectURL: vi.fn(),
    });

    await drop(
      json('result.json', JSON.stringify(withShot)),
      new File(['x'], 'kit.png', { type: 'image/png' }),
    );

    const images = Array.from(root().querySelectorAll('img'), (img) => img.getAttribute('src'));
    expect(images).toEqual(['blob:kit.png']);
    // The one not dropped is named, not hidden.
    expect(text()).toContain('vflow.png');
  });
});
