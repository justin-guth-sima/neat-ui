/*
 * The gauge's zones: where they start, and which one a value is in. Internal but for
 * `NeatGaugeZones`, which the entry exports.
 */

/**
 * Where a gauge's zones start, each a value from which its zone runs up to `max`: warning to the
 * danger start (or to `max` without one), danger to `max`. The value arc takes the color of the
 * zone it is in.
 */
export interface NeatGaugeZones {
  /** The value from which the warning zone starts. */
  readonly warning?: number;
  /** The value from which the danger zone starts. */
  readonly danger?: number;
}

/** A zone of the gauge: warning or danger, which the value arc's color and the words say. */
export type GaugeZone = 'warning' | 'danger';

/** Whether a zone's start is given, as a finite number; any other start leaves the zone out. */
const isZoneStart = (start: number | undefined): start is number =>
  start !== undefined && Number.isFinite(start);

/**
 * The zone `value` is in: danger from its start, else warning from its start, else none. The
 * value is the app's as given, not held to the range: a value past `max` that is over the danger
 * start is in danger.
 */
export function zoneAt(
  value: number | null | undefined,
  zones: NeatGaugeZones | null,
): GaugeZone | null {
  if (zones === null || value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (isZoneStart(zones.danger) && value >= zones.danger) return 'danger';
  if (isZoneStart(zones.warning) && value >= zones.warning) return 'warning';
  return null;
}
