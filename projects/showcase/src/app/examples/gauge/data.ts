/**
 * A reply's speed as a model streams it, in tokens per second, one reading a second: it starts
 * from nothing, climbs as the reply gets going and wavers around 40.
 */
export const REPLY_SPEEDS: readonly number[] = [
  0, 18, 34, 41, 44, 39, 46, 42, 37, 43, 48, 41, 35, 40, 45, 38,
];

/** Three sensors' temperatures in °C: one below the zones, one in warning, one in danger. */
export const SENSORS = [
  { name: 'A65', celsius: 62 },
  { name: 'EV74', celsius: 91 },
  { name: 'MLA', celsius: 104 },
] as const;

/** Where a board's temperature turns from fine to warning, and from warning to danger. */
export const TEMPERATURE_ZONES = { warning: 85, danger: 100 } as const;
