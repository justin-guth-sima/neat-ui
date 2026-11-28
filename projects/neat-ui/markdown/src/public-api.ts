/*
 * Public API surface of @sima/neat-ui/markdown: Markdown drawn in the kit's prose, as a model
 * writes its replies. A secondary entry point, so an app's main bundle carries it, and the
 * Markdown lexer with it, only if a page it loads imports it. It imports the primary and other
 * entries by package name; the primary never imports it. Every export added here is a promise to
 * consumers.
 */
export { NeatMarkdown } from './lib/markdown';
export { NEAT_CLOUD_BOX, type NeatCloudBox } from './lib/motion/cloud-box';
export { NEAT_TEXT_MOTIONS, type NeatTextMotion } from './lib/motion/text-motions';
export {
  neatSpeakable,
  type NeatSpeakableOptions,
  type NeatSpeakableSentence,
} from './lib/speech/speakable';
export {
  NEAT_SPEAKING_MOTIONS,
  type NeatSpeakingMotion,
  type NeatSpeech,
  type NeatSpeechSamples,
} from './lib/speech/speaking-motions';
