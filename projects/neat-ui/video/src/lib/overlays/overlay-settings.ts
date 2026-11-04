/** How a class's boxes and outlines are stroked. */
export type NeatOverlayLineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * A class style row: overlays whose label equals `label` draw in `color` with this line. The row
 * labelled `default` applies to every label without a row of its own.
 */
export interface NeatOverlayClassStyle {
  readonly label: string;
  readonly color: string;
  readonly style: NeatOverlayLineStyle;
  /** Line width in CSS pixels: thin (1) or thick (3). It overrides `general.lineWidth`. */
  readonly width: 1 | 3;
}

/**
 * A region of interest. Coordinates are normalized to 0..1 of the video frame, so a polygon fits
 * any resolution the stream is sent at.
 */
export interface NeatRoiPolygon {
  readonly type: 'inclusion' | 'exclusion';
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

/**
 * The resolved overlay settings for one channel. The app resolves them once per change (defaults,
 * global values, the channel's own values); drawing reads them every frame and never parses or
 * validates them.
 */
export interface NeatOverlaySettings {
  readonly general: {
    /** Line width in CSS pixels for every overlay line a class row does not override. */
    readonly lineWidth: number;
    /** Draw the ROI polygons under the detection, segmentation and tracking overlays. */
    readonly showRoi: boolean;
    /** Hide detections, segments and tracks whose box centre falls outside the ROI. */
    readonly applyRoiFiltering: boolean;
  };
  readonly types: {
    readonly 'object-detection': {
      readonly visible: boolean;
      /** 0..1; an object without a confidence always passes. */
      readonly confidenceThreshold: number;
      readonly objects: readonly NeatOverlayClassStyle[];
    };
    readonly segmentation: {
      readonly visible: boolean;
      /** 0..1; a segment without a confidence counts as fully confident. */
      readonly confidenceThreshold: number;
      /** 0..1, the alpha of mask fills. */
      readonly maskOpacity: number;
      readonly objects: readonly NeatOverlayClassStyle[];
    };
    readonly tracking: {
      readonly visible: boolean;
      readonly confidenceThreshold: number;
      readonly history: {
        /** Draw each track's recent centre positions as a trail. */
        readonly enabled: boolean;
        /** Positions kept per track. */
        readonly trailLength: number;
        /** How long the trail of a track that left the frame stays, in milliseconds. */
        readonly lostTrackTtlMs: number;
      };
    };
    readonly 'pose-estimation': {
      readonly visible: boolean;
      /** Dots on the joints. */
      readonly showKeypoints: boolean;
      /** Joint names next to the dots. */
      readonly showKeypointLabels: boolean;
      /** The box and label plate around each pose. */
      readonly showBoxes: boolean;
      /**
       * Colour, line and width by the pose's label (`person`, `hand`); a pose without a row keeps
       * its identity colour.
       */
      readonly objects: readonly NeatOverlayClassStyle[];
    };
    readonly classification: { readonly visible: boolean };
  };
  readonly roi: readonly NeatRoiPolygon[];
}

/** The settings a channel draws with when nothing is stored. */
export const NEAT_OVERLAY_DEFAULTS: NeatOverlaySettings = {
  general: { lineWidth: 3, showRoi: true, applyRoiFiltering: true },
  types: {
    'object-detection': { visible: true, confidenceThreshold: 0, objects: [] },
    segmentation: { visible: true, confidenceThreshold: 0, maskOpacity: 0.4, objects: [] },
    tracking: {
      visible: true,
      confidenceThreshold: 0,
      history: { enabled: true, trailLength: 10, lostTrackTtlMs: 2000 },
    },
    'pose-estimation': {
      visible: true,
      showKeypoints: true,
      showKeypointLabels: false,
      showBoxes: true,
      objects: [],
    },
    classification: { visible: true },
  },
  roi: [],
};
