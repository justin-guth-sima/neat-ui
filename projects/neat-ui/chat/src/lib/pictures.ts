import type { NeatChatPicture } from './types';

/** Numbers the pictures of a page, for their ids. */
let nextPicture = 0;

/**
 * A picture for the message box or a message, from an image file: an object URL to show it, its
 * file name as its alternative text, and the file itself, for the app to send. The object URL
 * lives until it is revoked: the message box revokes a picture removed from it, and once a draft
 * is sent its pictures are the app's, to revoke when they are no longer shown.
 */
export function pictureFromFile(file: File): NeatChatPicture {
  return {
    id: `neat-picture-${nextPicture++}`,
    src: URL.createObjectURL(file),
    name: file.name,
    file,
  };
}

/** Frees a picture's object URL; any other address is left alone. Internal. */
export function revokePicture(picture: NeatChatPicture): void {
  if (picture.src.startsWith('blob:')) URL.revokeObjectURL(picture.src);
}
