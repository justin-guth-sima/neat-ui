import { readMachine } from './machine-info';

describe('readMachine', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the page’s own view of the machine, with the label and the measured refresh', async () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const machine = await readMachine('laptop', 120);

    expect(machine.label).toBe('laptop');
    expect(machine.refreshHz).toBe(120);
    expect(machine.ua).toBe(navigator.userAgent);
    expect(machine.cores).toBe(navigator.hardwareConcurrency);
    expect(machine.dpr).toBe(2);
    expect(machine.viewport).toEqual({ w: innerWidth, h: innerHeight });
    expect(machine.screen).toEqual({ w: screen.width, h: screen.height });
  });

  it('keeps going where the browser has no high-entropy values or WebGL', async () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'x', hardwareConcurrency: 4 });
    const machine = await readMachine('board', 30);

    expect(machine.uaData).toBeUndefined();
    expect(machine.webgl).toBeUndefined();
    expect(machine.deviceMemory).toBeUndefined();
  });

  it('keeps going when the high-entropy values are refused', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'x',
      hardwareConcurrency: 4,
      userAgentData: {
        getHighEntropyValues: () => Promise.reject(new Error('blocked by policy')),
      },
    });
    const machine = await readMachine('board', 30);
    expect(machine.uaData).toBeUndefined();
  });

  it('reports the unmasked WebGL renderer when the browser gives it', async () => {
    const getParameter = (what: number) => (what === 1 ? 'Vendor Inc' : 'Renderer 9000');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl'
        ? {
            getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 1, UNMASKED_RENDERER_WEBGL: 2 }),
            getParameter,
          }
        : null) as never);
    try {
      const machine = await readMachine('laptop', 60);
      expect(machine.webgl).toEqual({ vendor: 'Vendor Inc', renderer: 'Renderer 9000' });
    } finally {
      vi.restoreAllMocks();
    }
  });
});
