/** One video frame the browser presented. */
export interface PresentedFrame {
  /** When it was presented, on the `performance.now()` clock. */
  readonly now: number;
  /** Its RTP timestamp, or null when the browser reports none. */
  readonly rtpTimestamp: number | null;
}

/**
 * Calls `onFrame` once for each frame `video` presents, until the returned function is called.
 * Internal to the tile: it touches no Angular state, so the caller runs it outside Angular.
 *
 * `requestVideoFrameCallback` reports each presented frame with its RTP timestamp, which is what
 * frame-exact metadata matching needs. Browsers without it get an animation-frame loop that
 * reports a frame whenever the decoded-frame count has advanced, with no RTP timestamp, so
 * metadata falls back to arrival matching. A callback while the video holds no current frame
 * (`readyState` below HAVE_CURRENT_DATA) is not a presented frame.
 *
 * The next callback is requested before `onFrame` runs, so a frame whose handler throws does not
 * end the loop.
 */
export function startFrameLoop(
  video: HTMLVideoElement,
  onFrame: (frame: PresentedFrame) => void,
): () => void {
  return typeof video.requestVideoFrameCallback === 'function'
    ? videoFrameLoop(video, onFrame)
    : animationFrameLoop(video, onFrame);
}

function hasCurrentFrame(video: HTMLVideoElement): boolean {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function videoFrameLoop(
  video: HTMLVideoElement,
  onFrame: (frame: PresentedFrame) => void,
): () => void {
  let stopped = false;
  let pending = 0;
  const request = () => {
    pending = video.requestVideoFrameCallback((now, metadata) => {
      if (stopped) return;
      request();
      if (!hasCurrentFrame(video)) return;
      onFrame({ now, rtpTimestamp: metadata.rtpTimestamp ?? null });
    });
  };
  request();
  return () => {
    stopped = true;
    video.cancelVideoFrameCallback(pending);
  };
}

function animationFrameLoop(
  video: HTMLVideoElement,
  onFrame: (frame: PresentedFrame) => void,
): () => void {
  let stopped = false;
  let pending = 0;
  let decoded = 0;
  const request = () => {
    pending = requestAnimationFrame((now) => {
      if (stopped) return;
      request();
      // Every browser without requestVideoFrameCallback has getVideoPlaybackQuality.
      const total = video.getVideoPlaybackQuality().totalVideoFrames;
      if (total === decoded || !hasCurrentFrame(video)) return;
      decoded = total;
      onFrame({ now, rtpTimestamp: null });
    });
  };
  request();
  return () => {
    stopped = true;
    cancelAnimationFrame(pending);
  };
}
