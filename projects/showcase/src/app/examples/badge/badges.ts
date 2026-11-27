/** The surfaces a chip is shown on: the page, and a card. */
export const SURFACES = ['page', 'card'] as const;

/** One chip per tone, each worded as a stream's slot states are. */
export const CHIPS = [
  { tone: 'neutral', label: 'Idle' },
  { tone: 'success', label: 'Live' },
  { tone: 'warning', label: 'Unreachable' },
  { tone: 'danger', label: 'Auth failed' },
  { tone: 'info', label: 'Connecting' },
  { tone: 'highlight', label: 'External' },
] as const;
