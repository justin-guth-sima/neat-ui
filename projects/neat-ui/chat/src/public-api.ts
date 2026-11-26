/*
 * Public API surface of @sima/neat-ui/chat: a conversation with a model, its transcript, its
 * message box and push-to-talk. A secondary entry point, so an app's main bundle carries it only
 * if a page it loads imports it. It imports the primary and other entries by package name; the
 * primary never imports it. Every export added here is a promise to consumers.
 */
export {
  NEAT_MESSAGE_BOX_GLOWS,
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from './lib/message-box';
export { NEAT_PICTURE_MOTIONS, type NeatPictureMotion } from './lib/picture-reading';
export { pictureFromFile } from './lib/pictures';
export {
  NEAT_LISTENING_MOTIONS,
  NeatPushToTalk,
  type NeatListeningMotion,
} from './lib/push-to-talk';
export { NeatChatErrorActions, NeatChatMessageFooter, NeatChatTranscript } from './lib/transcript';
export type {
  NeatChatDraft,
  NeatChatMessage,
  NeatChatPicture,
  NeatChatRole,
  NeatChatState,
} from './lib/types';
