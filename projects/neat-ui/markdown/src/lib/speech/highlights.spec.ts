import { afterEach, describe, expect, it } from 'vitest';
import { HighlightRanges } from './highlights';
import { installHighlights, litText } from './speech.testing';

describe('HighlightRanges', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('two instances share a highlight and each removes only its ranges', () => {
    const registry = installHighlights();
    const text = document.createElement('p');
    text.textContent = 'one two';
    document.body.append(text);
    const range = (from: number, to: number) => {
      const r = document.createRange();
      r.setStart(text.firstChild!, from);
      r.setEnd(text.firstChild!, to);
      return r;
    };
    const a = new HighlightRanges(document);
    const b = new HighlightRanges(document);
    a.set('neat-speech-said', [range(0, 3)]);
    b.set('neat-speech-said', [range(4, 7)]);
    expect(registry.get('neat-speech-said')!.size).toBe(2);
    expect(litText(registry, 'neat-speech-said')).toBe('onetwo');
    a.set('neat-speech-said', []);
    expect(litText(registry, 'neat-speech-said')).toBe('two');
    b.clear();
    expect(registry.get('neat-speech-said')!.size).toBe(0);
    text.remove();
  });

  it('without the Highlight API nothing is lit and nothing throws', () => {
    vi.stubGlobal('CSS', undefined);
    const ranges = new HighlightRanges(document);
    expect(() => ranges.set('neat-speech-word', [document.createRange()])).not.toThrow();
    expect(() => ranges.clear()).not.toThrow();
  });
});
