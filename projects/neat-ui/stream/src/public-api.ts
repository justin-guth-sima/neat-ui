/*
 * Public API surface of @sima/neat-ui/stream: a streamed reply to a POST (`neatStreamPost`) and an
 * app server's events (`NeatEventStream`). A secondary entry point, so an app's main bundle carries
 * it only if a page it loads imports it. It imports nothing from the primary entry point; the
 * primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatEventStream } from './lib/event-stream';
export { neatStreamPost, NeatStreamError, type NeatStreamPostOptions } from './lib/stream-post';
