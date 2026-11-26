import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatDialog } from '@sima/neat-ui/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NeatChatPicture } from '../types';
import { fakeMediaDevices } from '../voice/media.testing';
import { CameraDialog } from './camera-dialog';
import { CAMERA_DEPS, type CameraDeps } from './camera';

@Component({ template: '' })
class Opener {
  readonly dialogs = inject(NeatDialog);
}

describe('CameraDialog', () => {
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const button = (name: string) =>
    [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (candidate) => candidate.textContent?.trim() === name,
    )!;
  const video = () => dialog()!.querySelector('video')!;
  let blobs: number;
  // What the fakes replace, put back after each case: specs of other parts share this window.
  const real = {
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
    getContext: HTMLCanvasElement.prototype.getContext,
    toBlob: HTMLCanvasElement.prototype.toBlob,
  };

  beforeEach(() => {
    blobs = 0;
    URL.createObjectURL = () => 'blob:photo';
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage: vi.fn(),
    })) as unknown as HTMLCanvasElement['getContext'];
    HTMLCanvasElement.prototype.toBlob = function (done: BlobCallback) {
      blobs++;
      queueMicrotask(() => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
    };
  });

  afterEach(() => {
    URL.createObjectURL = real.createObjectURL;
    URL.revokeObjectURL = real.revokeObjectURL;
    HTMLCanvasElement.prototype.getContext = real.getContext;
    HTMLCanvasElement.prototype.toBlob = real.toBlob;
    vi.unstubAllGlobals();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  async function open(deps: Partial<CameraDeps> = {}) {
    const devices = fakeMediaDevices();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CAMERA_DEPS,
          useValue: { isSecureContext: true, mediaDevices: devices, ...deps },
        },
      ],
    });
    const fixture = TestBed.createComponent(Opener);
    const ref = fixture.componentInstance.dialogs.open<CameraDialog, NeatChatPicture>(
      CameraDialog,
      { title: 'Take a picture', inputs: {} },
    );
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
    };
    await settle();
    let result: NeatChatPicture | undefined | 'open' = 'open';
    void ref.closed.then((value) => (result = value));
    /** The camera gives its stream, and the video its first frame. */
    const play = async () => {
      const stream = devices.grant();
      await settle();
      Object.defineProperty(video(), 'videoWidth', { value: 1280 });
      Object.defineProperty(video(), 'videoHeight', { value: 720 });
      video().dispatchEvent(new Event('loadeddata'));
      await settle();
      return stream;
    };
    return { fixture, ref, devices, settle, play, result: () => result };
  }

  it('shows the preview and enables Take once the video has a frame', async () => {
    const t = await open();
    expect(dialog()!.textContent).toContain('Take a picture');
    expect(button('Take').getAttribute('aria-disabled')).toBe('true');
    const stream = await t.play();
    expect((video() as HTMLVideoElement & { srcObject: unknown }).srcObject).toBe(stream.asStream);
    expect(video().muted).toBe(true);
    expect(video().hasAttribute('playsinline')).toBe(true);
    expect(button('Take').getAttribute('aria-disabled')).toBeNull();
  });

  it('Take closes with a picture named Photo from the camera', async () => {
    const t = await open();
    await t.play();
    button('Take').click();
    await t.settle();
    const picture = t.result() as NeatChatPicture;
    expect(picture.name).toBe('Photo from the camera');
    expect(picture.src).toBe('blob:photo');
    expect(picture.file?.type).toBe('image/jpeg');
    expect(picture.file?.name).toMatch(/^camera-\d\d-\d\d-\d\d\.jpg$/);
  });

  it('says Camera blocked and No camera in place of the preview', async () => {
    for (const [error, words] of [
      ['NotAllowedError', 'Camera blocked'],
      ['NotFoundError', 'No camera'],
    ] as const) {
      TestBed.resetTestingModule();
      const t = await open();
      t.devices.refuse(error);
      await t.settle();
      expect(dialog()!.querySelector('video')).toBeNull();
      expect(dialog()!.querySelector('neat-callout')!.textContent).toContain(words);
      expect(button('Take').getAttribute('aria-disabled')).toBe('true');
      t.ref.close();
      await t.settle();
    }
  });

  it('stops the stream when it closes by Cancel, Escape or Take', async () => {
    let t = await open();
    let stream = await t.play();
    button('Cancel').click();
    await t.settle();
    expect(stream.stopped()).toBe(true);
    expect(t.result()).toBeUndefined();

    TestBed.resetTestingModule();
    t = await open();
    stream = await t.play();
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await t.settle();
    expect(dialog()).toBeNull();
    expect(stream.stopped()).toBe(true);

    TestBed.resetTestingModule();
    t = await open();
    stream = await t.play();
    button('Take').click();
    await t.settle();
    expect(stream.stopped()).toBe(true);
  });

  it('a stream that comes after the dialog closed is stopped at once', async () => {
    const t = await open();
    t.ref.close();
    await t.settle();
    const stream = t.devices.grant();
    await t.settle();
    expect(stream.stopped()).toBe(true);
  });

  it('a second Take while the first is taken does nothing', async () => {
    const t = await open();
    await t.play();
    button('Take').click();
    button('Take').click();
    await t.settle();
    expect(blobs).toBe(1);
  });

  it('a picture that fails to encode says so in place, keeps the preview and lets Take try again', async () => {
    let fail = true;
    HTMLCanvasElement.prototype.toBlob = function (done: BlobCallback) {
      blobs++;
      queueMicrotask(() => done(fail ? null : new Blob(['jpeg'], { type: 'image/jpeg' })));
    };
    const t = await open();
    await t.play();
    button('Take').click();
    await t.settle();
    expect(t.result()).toBe('open');
    expect(dialog()!.querySelector('neat-error-note')!.textContent).toContain(
      'The picture could not be taken. Try again.',
    );
    expect(dialog()!.querySelector('video')).not.toBeNull();
    expect(button('Take').getAttribute('aria-disabled')).toBeNull();
    fail = false;
    button('Take').click();
    await t.settle();
    expect((t.result() as NeatChatPicture).name).toBe('Photo from the camera');
  });

  it('a camera that goes away mid-preview says No camera, stops it and takes nothing', async () => {
    const t = await open();
    const stream = await t.play();
    stream.tracks[0].end();
    await t.settle();
    expect(dialog()!.querySelector('video')).toBeNull();
    expect(dialog()!.querySelector('neat-callout')!.textContent).toContain('No camera');
    expect(stream.stopped()).toBe(true);
    expect(button('Take').getAttribute('aria-disabled')).toBe('true');
    button('Take').click();
    await t.settle();
    expect(blobs).toBe(0);
    expect(t.result()).toBe('open');
  });
});
