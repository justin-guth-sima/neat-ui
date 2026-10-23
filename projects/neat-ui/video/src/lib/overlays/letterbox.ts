/**
 * Maps source-video pixels onto the overlay: `x * scaleX + offsetX`. Metadata coordinates are in
 * video pixels, and the video is shown with `object-fit: contain`, so the mapping includes the bars.
 */
export interface Letterbox {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * The mapping for a `videoWidth`×`videoHeight` video contained in a `boxWidth`×`boxHeight` box.
 * Before the video reports its size, the mapping is the identity.
 */
export function letterbox(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): Letterbox {
  if (!videoWidth || !videoHeight) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };

  const videoAspect = videoWidth / videoHeight;
  let drawWidth: number;
  let drawHeight: number;
  let offsetX = 0;
  let offsetY = 0;
  if (boxWidth / boxHeight > videoAspect) {
    // The box is wider than the video: bars left and right.
    drawHeight = boxHeight;
    drawWidth = videoAspect * drawHeight;
    offsetX = (boxWidth - drawWidth) / 2;
  } else {
    // The box is taller than the video: bars top and bottom.
    drawWidth = boxWidth;
    drawHeight = drawWidth / videoAspect;
    offsetY = (boxHeight - drawHeight) / 2;
  }
  return { scaleX: drawWidth / videoWidth, scaleY: drawHeight / videoHeight, offsetX, offsetY };
}
