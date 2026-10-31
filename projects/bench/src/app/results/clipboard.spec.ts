import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes through the async clipboard where the page may use it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText(document, 'hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('copies through a selected text area where the page may not (plain http)', async () => {
    vi.stubGlobal('navigator', {});
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    let copied = '';
    exec.mockImplementation(() => {
      copied = document.querySelector('textarea')!.value;
      return true;
    });

    await expect(copyText(document, 'from the board')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(copied).toBe('from the board');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the async clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyText(document, 'x')).resolves.toBe(true);
  });

  it('says it could not copy, and leaves nothing behind, where both ways fail', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(false);

    await expect(copyText(document, 'x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
