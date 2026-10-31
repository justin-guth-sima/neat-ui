import type { MachineInfo } from './result';

/*
 * What the page can tell about the machine it runs on (design 4.2, `machine`): the user agent and
 * its high-entropy values, cores, memory, screen, pixel ratio and the unmasked WebGL renderer.
 * Everything here is optional in some browser, so each read is guarded: a missing one is left out
 * of the result, never a reason to lose the run. The harness adds what only it can see (CDP's GPU
 * info, the board's `uname`).
 */

interface UaDataLike {
  getHighEntropyValues(hints: string[]): Promise<unknown>;
}

const HINTS = [
  'architecture',
  'bitness',
  'model',
  'platform',
  'platformVersion',
  'fullVersionList',
];

async function highEntropy(): Promise<unknown> {
  try {
    const data = (navigator as Navigator & { userAgentData?: UaDataLike }).userAgentData;
    return data ? await data.getHighEntropyValues(HINTS) : undefined;
  } catch {
    return undefined;
  }
}

/** The GPU the browser reports through WebGL, where it says (it may be masked or absent). */
function webglInfo(): MachineInfo['webgl'] {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (!gl || !info) return undefined;
    return {
      vendor: String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)),
      renderer: String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)),
    };
  } catch {
    return undefined;
  }
}

/** The machine as the page sees it; `refreshHz` is the run's measured, snapped refresh. */
export async function readMachine(label: string, refreshHz: number): Promise<MachineInfo> {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    label,
    ua: navigator.userAgent,
    uaData: await highEntropy(),
    cores: navigator.hardwareConcurrency,
    deviceMemory,
    dpr: window.devicePixelRatio,
    screen: { w: screen.width, h: screen.height },
    viewport: { w: innerWidth, h: innerHeight },
    refreshHz,
    webgl: webglInfo(),
  };
}
