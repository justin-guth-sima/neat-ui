import type { NeatDiagramMessageStep } from '@sima/neat-ui/diagram';

/**
 * The Detector's steps for the messaging layer: a frame that reaches Resize goes on to YOLOX once
 * Resize's stage time has passed, and on to NMS after YOLOX's.
 */
export const PIPELINE_MESSAGE_STEPS: Readonly<Record<string, NeatDiagramMessageStep>> = {
  'resize-yolox': { from: 'detector', stage: 'resize' },
  'yolox-nms': { from: 'detector', stage: 'yolox' },
};
