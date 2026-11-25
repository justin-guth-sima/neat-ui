import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';
import { type MediaProblem, mediaProblemOf } from '../voice/media-problem';

/** What the camera takes from the browser, so a spec can give fakes. */
export interface CameraDeps {
  readonly isSecureContext: boolean;
  readonly mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined;
}

/** The window's secure context and camera; specs provide fakes. Internal. */
export const CAMERA_DEPS = new InjectionToken<CameraDeps>('CAMERA_DEPS', {
  providedIn: 'root',
  factory: (): CameraDeps => {
    const window = inject(DOCUMENT).defaultView;
    return {
      isSecureContext: window?.isSecureContext ?? false,
      mediaDevices: window?.navigator.mediaDevices,
    };
  },
});

/** The size asked of the camera, if it can: 720p, enough for the model and quick to send. */
const IDEAL = { width: { ideal: 1280 }, height: { ideal: 720 } };
/** The photo's JPEG quality. */
const QUALITY = 0.9;

/** Asks for the camera: its stream, or why there is none. Internal. */
export async function openCamera(
  deps: CameraDeps,
): Promise<{ readonly stream: MediaStream } | { readonly problem: MediaProblem }> {
  if (!deps.isSecureContext) return { problem: 'insecure' };
  if (!deps.mediaDevices?.getUserMedia) return { problem: 'unsupported' };
  try {
    return { stream: await deps.mediaDevices.getUserMedia({ video: IDEAL, audio: false }) };
  } catch (error) {
    return { problem: mediaProblemOf(error) };
  }
}

/** The video's frame now as a JPEG (0.9), at its own size, named `camera-<hh>-<mm>-<ss>.jpg`. */
export async function takePhoto(
  video: HTMLVideoElement,
  document: Document,
  now: Date,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('The camera gave no picture');
  const two = (value: number) => String(value).padStart(2, '0');
  const name = `camera-${two(now.getHours())}-${two(now.getMinutes())}-${two(now.getSeconds())}.jpg`;
  return new File([blob], name, { type: 'image/jpeg' });
}

/** Stops every track of a stream, so the browser's camera indicator goes off. */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
