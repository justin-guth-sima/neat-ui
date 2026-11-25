/*
 * Public API surface of @sima/neat-ui/chat: a conversation with a model, its transcript and its
 * message box. A secondary entry point, so an app's main bundle carries it only if a page it loads
 * imports it. It imports the primary and other entries by package name; the primary never imports
 * it. Every export added here is a promise to consumers.
 */
export {
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from './lib/message-box';
export { pictureFromFile } from './lib/pictures';
export { NeatChatErrorActions, NeatChatMessageFooter, NeatChatTranscript } from './lib/transcript';
export type {
  NeatChatDraft,
  NeatChatMessage,
  NeatChatPicture,
  NeatChatRole,
  NeatChatState,
} from './lib/types';
