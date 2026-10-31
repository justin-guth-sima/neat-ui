import { LADDERS, type LadderId } from './ladders';

/*
 * The automatic mode's settings, from the page's query string (design 4.1, "Board, no harness":
 * `?auto=1&host=kit&ladder=A&seed=1&steps=3`). Hash routing keeps the query where the board's
 * plain static server leaves it. A value that is not valid throws, saying which: a run with the
 * wrong ladder is worse than none.
 */

export type AutoHost = 'kit' | 'vflow' | 'none';

export interface AutoParams {
  readonly host: AutoHost;
  readonly ladder: LadderId;
  /** Seeds the diagram and its messages. */
  readonly seed: number;
  /** Climb only the ladder's first `steps` levels; undefined for all. */
  readonly steps: number | undefined;
  /** The machine's label in the result. */
  readonly machine: string;
  /** Bisect the knee after the climb (design 2.4, `--refine`). */
  readonly refine: boolean;
}

const HOSTS: readonly AutoHost[] = ['kit', 'vflow', 'none'];

function whole(value: string | null, name: string, least: number): number | undefined {
  if (value === null) return undefined;
  const number = Number(value);
  if (value.trim() === '' || !Number.isInteger(number) || number < least) {
    throw new RangeError(`${name} is a whole number from ${least}, not "${value}"`);
  }
  return number;
}

/** The settings, or null where the query does not ask for an automatic run (`auto=1`). */
export function autoParams(search: string): AutoParams | null {
  const query = new URLSearchParams(search);
  const auto = query.get('auto');
  if (auto !== '1' && auto !== 'true') return null;

  const host = query.get('host') ?? 'kit';
  if (host === 'vflow-virt') {
    throw new RangeError('host vflow-virt is not built yet: it comes with the harness (Task 5)');
  }
  if (!(HOSTS as readonly string[]).includes(host)) {
    throw new RangeError(`host is one of ${HOSTS.join(', ')}, not "${host}"`);
  }
  const ladder = (query.get('ladder') ?? 'A').toUpperCase();
  if (!(ladder in LADDERS)) {
    throw new RangeError(`ladder is one of ${Object.keys(LADDERS).join(', ')}, not "${ladder}"`);
  }
  const refine = query.get('refine');
  return {
    host: host as AutoHost,
    ladder: ladder as LadderId,
    seed: whole(query.get('seed'), 'seed', 0) ?? 1,
    steps: whole(query.get('steps'), 'steps', 1),
    machine: query.get('machine') ?? 'unlabelled',
    refine: refine === '1' || refine === 'true',
  };
}
