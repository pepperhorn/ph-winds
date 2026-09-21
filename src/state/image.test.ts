import { describe, it, expect, vi } from 'vitest';
import {
  fileToCardImage, formatSize, ImageTooLargeError, MAX_UPLOAD_BYTES, outputMimeType, targetSize,
  type DecodedImage, type ImageDecoder,
} from './image';

const file = (type: string, size = 10) => {
  const f = new File(['x'], 'pic', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

/** A decoder that records what it was asked to encode, so the tests never
 * need a real canvas. */
function fakeDecoder(width: number, height: number, result: (w: number, h: number, mime: string) => string) {
  const release = vi.fn();
  const encode = vi.fn((w: number, h: number, mime: string) => result(w, h, mime));
  const decode: ImageDecoder = async () => ({ width, height, encode, release } as DecodedImage);
  return { decode, encode, release };
}

describe('targetSize', () => {
  it('fits the longest edge into the box, preserving aspect ratio', () => {
    expect(targetSize(1600, 800, 640)).toEqual({ width: 640, height: 320 });
    expect(targetSize(800, 1600, 640)).toEqual({ width: 320, height: 640 });
  });
  it('never upscales', () => {
    expect(targetSize(120, 60, 640)).toEqual({ width: 120, height: 60 });
  });
  it('never rounds an edge away to zero', () => {
    expect(targetSize(1000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe('outputMimeType', () => {
  it('keeps alpha for PNG and WebP sources, and encodes everything else as JPEG', () => {
    expect(outputMimeType('image/png')).toBe('image/png');
    expect(outputMimeType('image/webp')).toBe('image/png');
    expect(outputMimeType('image/jpeg')).toBe('image/jpeg');
  });
});

describe('fileToCardImage', () => {
  it('downscales and returns a data URI, then releases the bitmap', async () => {
    const { decode, encode, release } = fakeDecoder(1600, 800, () => 'data:image/png;base64,AAAA');
    await expect(fileToCardImage(file('image/png'), {}, decode)).resolves.toBe('data:image/png;base64,AAAA');
    expect(encode).toHaveBeenCalledWith(640, 320, 'image/png', 0.82);
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the bitmap even when the encode throws', async () => {
    const { decode, release } = fakeDecoder(10, 10, () => { throw new Error('no ctx'); });
    await expect(fileToCardImage(file('image/png'), {}, decode)).rejects.toThrow('no ctx');
    expect(release).toHaveBeenCalledOnce();
  });

  it('refuses a non-image, an SVG and an empty file', async () => {
    const { decode } = fakeDecoder(10, 10, () => 'data:image/png;base64,AAAA');
    await expect(fileToCardImage(null, {}, decode)).rejects.toThrow('No file was chosen.');
    await expect(fileToCardImage(file('application/pdf'), {}, decode)).rejects.toThrow(/not a picture/);
    await expect(fileToCardImage(file('image/svg+xml'), {}, decode)).rejects.toThrow(/SVG pictures cannot be added/);
    await expect(fileToCardImage(file('image/png', 0), {}, decode)).rejects.toThrow(/empty/);
  });

  it('refuses an oversized pick before decoding it at all', async () => {
    const { decode, encode } = fakeDecoder(10, 10, () => 'data:image/png;base64,AAAA');
    await expect(fileToCardImage(file('image/png', MAX_UPLOAD_BYTES + 1), {}, decode))
      .rejects.toBeInstanceOf(ImageTooLargeError);
    expect(encode).not.toHaveBeenCalled();
  });

  it('refuses a blocked canvas rather than storing "data:,"', async () => {
    const { decode } = fakeDecoder(10, 10, () => 'data:,');
    await expect(fileToCardImage(file('image/png'), {}, decode)).rejects.toThrow(/could not be prepared/);
  });

  it('refuses a picture still over the per-image cap after shrinking', async () => {
    const { decode } = fakeDecoder(10, 10, () => `data:image/png;base64,${'A'.repeat(200)}`);
    await expect(fileToCardImage(file('image/png'), { maxChars: 100 }, decode))
      .rejects.toThrow(/still too large after shrinking/);
  });
});

describe('formatSize', () => {
  it('reads as a size, not a spec', () => {
    expect(formatSize(512 * 1024)).toBe('512 KB');
    expect(formatSize(20 * 1024 * 1024)).toBe('20.0 MB');
  });
});
