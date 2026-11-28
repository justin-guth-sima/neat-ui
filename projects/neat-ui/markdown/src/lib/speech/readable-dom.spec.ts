import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownBlocks } from '../blocks';
import { NeatMarkdown } from '../markdown';
import { MOTION_CLOCK } from '../motion/motion-clock';
import { steppedFrames } from '../motion/motion.testing';
import { NEAT_TEXT_MOTIONS, type NeatTextMotion } from '../motion/text-motions';
import { readableBlocks } from './readable';
import { readableNodes } from './readable-dom';

@Component({
  imports: [NeatMarkdown],
  template: `<neat-markdown [text]="text()" [streaming]="streaming()" [motion]="motion()" />`,
})
class Host {
  readonly text = signal('');
  readonly streaming = signal(false);
  readonly motion = signal<NeatTextMotion>('plain');
}

/** A reply with every kind of block and run, raw HTML, a picture and a task item among them. */
const CORPUS =
  '## Pasta\n\nThree **jars** of *dried* [pasta](https://x.y), `code` and \\* an escape.\n' +
  'A soft break and a hard  \nbreak.\n\n- [x] Done\n- Next <b>raw</b> one\n  1. nested\n\n' +
  '> Quoted.\n\n![a jar](jar.png) after.\n\n<div>block html</div>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n' +
  '```py\nprint(1)\n```\n\n---\n\nThe end.';

/** The text readableBlocks reads of `text`. */
function readText(text: string, streaming: boolean): string {
  return readableBlocks(new MarkdownBlocks().update(text, streaming), text)
    .flatMap((block) => block.leaves.map((leaf) => leaf.text))
    .join('');
}

/** The text the DOM walk reads. */
function walkText(host: HTMLElement): string {
  const walk = readableNodes(host);
  const text = walk.nodes.map((node) => node.data).join('');
  expect(walk.length).toBe(text.length);
  const starts: number[] = [];
  let start = 0;
  for (const node of walk.nodes) {
    starts.push(start);
    start += node.data.length;
  }
  expect([...walk.starts]).toEqual(starts);
  return text;
}

describe('readableNodes', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [{ provide: MOTION_CLOCK, useValue: steppedFrames() }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  // One test per motion: each renders the reply at every one of its hundred writes.
  it.each(NEAT_TEXT_MOTIONS.map((motion) => [motion]))(
    'walks the same text readableBlocks reads at every write (%s)',
    (motion) => {
      const fixture = TestBed.createComponent(Host);
      const host = fixture.componentInstance;
      host.motion.set(motion);
      host.streaming.set(true);
      // Written in pieces, so the motions render their pieces.
      const pieces = CORPUS.match(/\s+|\S+/g)!;
      let text = '';
      for (const piece of pieces) {
        text += piece;
        host.text.set(text);
        fixture.detectChanges();
        const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
        expect(walkText(element), `at ${text.length}`).toBe(readText(text, true));
      }
      host.streaming.set(false);
      fixture.detectChanges();
      const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
      expect(walkText(element)).toBe(readText(CORPUS, false));
      fixture.destroy();
    },
  );

  it('skips code blocks, tables, hidden layers and unread runs', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.text.set(CORPUS);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
    const text = walkText(element);
    expect(text).not.toContain('print(1)');
    expect(text).not.toContain('a jar');
    expect(text).not.toContain('block html');
    expect(text).not.toContain('<b>');
    expect(text).not.toContain('☑');
    expect(text).toContain('code');
    expect(text).toContain('raw');
    const hidden = document.createElement('span');
    hidden.setAttribute('aria-hidden', 'true');
    hidden.textContent = 'noise';
    element.append(hidden);
    expect(walkText(element)).toBe(text);
  });
});
