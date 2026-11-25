import { pictureFromFile, revokePicture } from './pictures';

describe('pictures', () => {
  let created: Blob[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    let next = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return `blob:picture-${next++}`;
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('pictureFromFile makes an object URL and a unique id', () => {
    const file = new File(['x'], 'shelf.jpg', { type: 'image/jpeg' });
    const one = pictureFromFile(file);
    const two = pictureFromFile(file);
    expect(one).toEqual({ id: one.id, src: 'blob:picture-0', name: 'shelf.jpg', file });
    expect(two.src).toBe('blob:picture-1');
    expect(one.id).not.toBe(two.id);
    expect(created).toEqual([file, file]);
  });

  it('revokePicture revokes it', () => {
    const picture = pictureFromFile(new File(['x'], 'a.png', { type: 'image/png' }));
    revokePicture(picture);
    expect(revoked).toEqual(['blob:picture-0']);
  });

  it('revokePicture leaves an address that is no object URL alone', () => {
    revokePicture({ id: 'p', src: 'https://example.com/a.png', name: 'a.png' });
    expect(revoked).toEqual([]);
  });
});
