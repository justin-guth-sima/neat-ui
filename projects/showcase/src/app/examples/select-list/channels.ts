/** A channel of the lists' demos. */
export interface Channel {
  readonly id: number;
  readonly name: string;
  readonly state: 'Idle' | 'Live';
}

/** Two dozen channels, a fifth of them live, so the list scrolls. */
export const CHANNELS: readonly Channel[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  name: `Channel ${index + 1}`,
  state: index % 5 === 1 ? 'Live' : 'Idle',
}));

/** An item's identity, as the list's `trackBy` asks for it. */
export const channelId = (channel: Channel): number => channel.id;
