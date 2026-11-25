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

/**
 * The mapping for the picture as the tile shows it: with `mirror`, x runs right to left across a
 * box `boxWidth` wide; with `flipVertical`, y runs bottom to top across a box `boxHeight` high;
 * with both, the picture is turned 180°. A negative scale turns a rectangle's width or height into
 * an extent the other way, which `strokeRect` and `fillRect` draw correctly, so strategies need no
 * case of their own for geometry. An image is the exception: a negative destination size does not
 * flip it (the browser normalizes the rectangle), so a strategy that draws one, the segmentation
 * overlay's RLE mask, turns the context by the scales' signs.
 */
export function orientLetterbox(
  box: Letterbox,
  boxWidth: number,
  boxHeight: number,
  mirror: boolean,
  flipVertical: boolean,
): Letterbox {
  return {
    scaleX: mirror ? -box.scaleX : box.scaleX,
    scaleY: flipVertical ? -box.scaleY : box.scaleY,
    offsetX: mirror ? boxWidth - box.offsetX : box.offsetX,
    offsetY: flipVertical ? boxHeight - box.offsetY : box.offsetY,
  };
}
