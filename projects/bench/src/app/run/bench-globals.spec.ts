import { TestBed } from '@angular/core/testing';
import { type BenchHost, BenchHosts } from '../hosts/bench-host';
import { installBenchGlobals } from './bench-globals';

describe('installBenchGlobals', () => {
  afterEach(() => {
    delete window.benchFairness;
    delete window.benchCompare;
    document.body.replaceChildren();
  });

  it('reads the registered host’s page at its transform, for the harness to call', () => {
    const hosts = TestBed.inject(BenchHosts);
    const host: BenchHost = {
      id: 'vflow',
      gestures: {
        rect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        transform: () => ({ k: 1, x: 0, y: 0 }),
        press: () => undefined,
        drag: () => undefined,
        release: () => undefined,
        wheel: () => undefined,
      },
      startTransform: () => null,
      fit: () => undefined,
    };
    hosts.register(host);
    installBenchGlobals(hosts);
    document.body.innerHTML = '<div class="block" data-node="b0"></div>';

    const fingerprint = window.benchFairness?.();

    expect(fingerprint?.host).toBe('vflow');
    expect(fingerprint?.transform).toEqual({ k: 1, x: 0, y: 0 });
    expect(Object.keys(fingerprint?.boxes ?? {})).toEqual(['node:b0']);
  });

  it('says so when no host is drawn', () => {
    installBenchGlobals(TestBed.inject(BenchHosts));
    expect(() => window.benchFairness?.()).toThrow(/no host/);
  });

  it('offers the comparison on the same page', () => {
    installBenchGlobals(TestBed.inject(BenchHosts));
    expect(typeof window.benchCompare).toBe('function');
  });
});
