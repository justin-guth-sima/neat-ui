import { InjectionToken } from '@angular/core';
import { ɵBROWSER_CLOCK, type ɵFrameClock } from '@sima/neat-ui';

/**
 * The clock and frames the chat parts' motions run by: the browser's, or a spec's that it steps by
 * hand. Internal.
 */
export const CHAT_CLOCK = new InjectionToken<ɵFrameClock>('CHAT_CLOCK', {
  providedIn: 'root',
  factory: () => ɵBROWSER_CLOCK,
});
