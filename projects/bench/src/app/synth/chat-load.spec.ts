import { CHAT_LOAD, ChatLoad, MOCKUP_REPLY, tokenize } from './chat-load';

describe('ChatLoad', () => {
  it('the same seed gives the same pieces and intervals', () => {
    const a = new ChatLoad(7, { reply: 'prose', pieces: 300, rate: 50 });
    const b = new ChatLoad(7, { reply: 'prose', pieces: 300, rate: 50 });
    expect(a.pieces).toEqual(b.pieces);
    expect(a.intervals).toEqual(b.intervals);
    expect(new ChatLoad(8, { reply: 'prose', pieces: 300, rate: 50 }).pieces).not.toEqual(a.pieces);
  });

  it('pieces join to the corpus', () => {
    const load = new ChatLoad(1, { reply: 'prose', pieces: CHAT_LOAD.pieces, rate: 50 });
    expect(load.pieces).toHaveLength(CHAT_LOAD.pieces);
    expect(load.corpus.startsWith(load.pieces.join(''))).toBe(true);
    expect(tokenize(load.corpus).join('')).toBe(load.corpus);
    expect(load.textAt(3)).toBe(load.pieces.slice(0, 3).join(''));
    // Prose: paragraphs, a list and bold.
    expect(load.corpus).toMatch(/\n\n/);
    expect(load.corpus).toMatch(/^- /m);
    expect(load.corpus).toMatch(/\*\*[^*]+\*\*/);
  });

  it("splits a long word as the mockup's tokenizer does", () => {
    expect(tokenize('Three jars of tomatoes, simmered')).toEqual([
      'Three',
      ' jars',
      ' of',
      ' tomat',
      'oes,',
      ' simm',
      'ered',
    ]);
  });

  it('waits 0.6 to 1.4 intervals of the rate between pieces', () => {
    const load = new ChatLoad(1, { reply: 'prose', pieces: 500, rate: 50 });
    expect(load.intervals).toHaveLength(500);
    for (const ms of load.intervals) {
      expect(ms).toBeGreaterThanOrEqual(12);
      expect(ms).toBeLessThan(28);
    }
  });

  it('the code reply is one fence of about 400 pieces', () => {
    const load = new ChatLoad(1, { reply: 'code', pieces: CHAT_LOAD.pieces, rate: 50 });
    expect(load.corpus.match(/```/g)).toHaveLength(2);
    expect(load.corpus).toMatch(/^[^`]+\n\n```python\n/);
    expect(load.corpus.endsWith('\n```')).toBe(true);
    // The tokenizer splits the opening fence too ("```py", "thon").
    const opened = load.pieces.findIndex((piece) => piece.includes('```'));
    const closed = load.pieces.findIndex((piece, i) => i > opened && piece.includes('```'));
    expect(closed - opened).toBeGreaterThanOrEqual(380);
    expect(closed - opened).toBeLessThanOrEqual(420);
    expect(load.pieces.join('')).toBe(load.corpus);
  });

  it('the mockup reply is the two sentences, done', () => {
    const load = new ChatLoad(1, { reply: 'mockup', pieces: CHAT_LOAD.pieces, rate: 50 });
    expect(load.corpus).toBe(MOCKUP_REPLY);
    expect(MOCKUP_REPLY).toBe(
      'Three jars of dried pasta, a bottle of olive oil, canned tomatoes and a braid of garlic. ' +
        'Together that is most of a pasta al pomodoro.',
    );
    expect(load.textAt(load.pieces.length)).toBe(MOCKUP_REPLY);
    expect(load.intervals).toHaveLength(load.pieces.length);
  });
});
