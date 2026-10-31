import type { BenchHosts } from '../hosts/bench-host';
import {
  compareFingerprints,
  type FairnessReport,
  fingerprintOf,
  type HostFingerprint,
} from '../hosts/fairness';

declare global {
  interface Window {
    /** The host on screen, read as the fairness check compares them (`fairness.ts`). */
    benchFairness?: () => HostFingerprint;
    /** The kit's fingerprint against vflow's, from two page loads, judged in the page. */
    benchCompare?: (kit: HostFingerprint, vflow: HostFingerprint) => FairnessReport;
  }
}

/**
 * Puts the fairness check where the harness calls it (`page.evaluate`): `benchFairness()` on the
 * kit's page and again on vflow's at the same transform, then `benchCompare(kit, vflow)` on either.
 */
export function installBenchGlobals(hosts: BenchHosts): void {
  window.benchFairness = () => {
    const host = hosts.current;
    if (!host) throw new Error('no host is drawn: open a renderer first');
    return fingerprintOf(document, host.id, host.gestures.rect(), host.gestures.transform());
  };
  window.benchCompare = compareFingerprints;
}
