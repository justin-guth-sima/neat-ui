import { describe, expect, it } from 'vitest';
import { fakeMediaDevices, FakeStream, flush } from '../voice/media.testing';
import { openCamera, stopStream, takePhoto } from './camera';

describe('the camera', () => {
  it('asks for 1280 × 720 video and no audio', async () => {
    const devices = fakeMediaDevices();
    const opened = openCamera({ isSecureContext: true, mediaDevices: devices });
    expect(devices.getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const stream = devices.grant();
    expect(await opened).toEqual({ stream: stream.asStream });
  });

  it('gives each problem: blocked, missing, busy, insecure', async () => {
    const devices = fakeMediaDevices();
    for (const [name, problem] of [
      ['NotAllowedError', 'blocked'],
      ['NotFoundError', 'missing'],
      ['NotReadableError', 'busy'],
    ] as const) {
      const opened = openCamera({ isSecureContext: true, mediaDevices: devices });
      devices.refuse(name);
      expect(await opened).toEqual({ problem });
    }
    expect(await openCamera({ isSecureContext: false, mediaDevices: devices })).toEqual({
      problem: 'insecure',
    });
    expect(await openCamera({ isSecureContext: true, mediaDevices: undefined })).toEqual({
      problem: 'unsupported',
    });
    await flush();
  });

  it("takes the video's frame at its own size as a JPEG named by the time", async () => {
    const drawn: unknown[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args: unknown[]) => drawn.push(args) }),
      toBlob: (done: (blob: Blob | null) => void, type: string, quality: number) =>
        done(new Blob([`${type} ${quality}`], { type })),
    };
    const fakeDocument = { createElement: () => canvas } as unknown as Document;
    const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;
    const file = await takePhoto(video, fakeDocument, new Date(2026, 10, 25, 9, 5, 7));
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    expect(drawn).toEqual([[video, 0, 0, 1920, 1080]]);
    expect(file.name).toBe('camera-09-05-07.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('image/jpeg 0.9');
  });

  it('stopStream stops every track', () => {
    const stream = new FakeStream('video', 'audio');
    stopStream(stream.asStream);
    expect(stream.stopped()).toBe(true);
  });
});
