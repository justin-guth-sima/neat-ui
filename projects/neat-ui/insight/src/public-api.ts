/*
 * Public API surface of @sima/neat-ui/insight: one Insight channel's video and metadata over
 * WebRTC, as a video tile's source. A secondary entry point, so that `video` stays free of any one
 * transport and an app that does not watch Insight carries none of it. It imports the `video`
 * entry point by package name, for the tile source's type only. Every export added here is a
 * promise to consumers.
 */
export {
  neatInsightChannel,
  type NeatInsightChannel,
  type NeatInsightChannelOptions,
} from './lib/insight-channel';
export type { NeatInsightVideoStats } from './lib/insight-connection';
