/**
 * Turning a picked file into the bounded `data:image/...` string a text card
 * stores. A data URI (rather than an object URL or a remote link) is what
 * makes a JSON export a complete backup: the board file carries its pictures.
 */

/** Longest edge, in px, a stored card picture is shrunk to fit. */
export const MAX_IMAGE_DIM = 640;

/** Encode quality for the lossy path. */
export const IMAGE_QUALITY = 0.82;

/** Ceiling for one stored picture, in data-URI characters (512 KB). */
export const MAX_IMAGE_CHARS = 512 * 1024;

/**
 * Ceiling on the *picked file*, checked before anything is decoded — this is
 * what stops a 100 MB pick being read into memory at all.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';

/** A size for a human, not a spec. Data URIs are ASCII, so chars ≈ bytes. */
export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Fit inside a `maxDim` box, preserving aspect ratio, and never upscale:
 * blowing a 120px thumbnail up to 640 costs storage and adds no detail.
 */
export function targetSize(width: number, height: number, maxDim = MAX_IMAGE_DIM) {
  const longest = Math.max(width, height);
  const scale = longest > maxDim ? maxDim / longest : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * PNG in, PNG out — and WebP out as PNG too, because canvas WebP encoding is
 * not universal and silently falling back to PNG is better than silently
 * falling back to a *blank* image. Everything else encodes as JPEG.
 */
export const outputMimeType = (sourceType: string): 'image/png' | 'image/jpeg' =>
  sourceType === 'image/png' || sourceType === 'image/webp' ? 'image/png' : 'image/jpeg';

/** A decoded bitmap, behind a seam so tests never need a real canvas. */
export interface DecodedImage {
  width: number;
  height: number;
  encode(width: number, height: number, mimeType: string, quality: number): string;
  release(): void;
}
export type ImageDecoder = (file: File) => Promise<DecodedImage>;

export class ImageTooLargeError extends Error {
  readonly bytes: number;
  readonly limit: number;
  constructor(message: string, bytes: number, limit: number) {
    super(message);
    this.name = 'ImageTooLargeError';
    this.bytes = bytes;
    this.limit = limit;
  }
}

/** Decode via an object URL and an `<img>`, then re-encode through a canvas. */
export const decodeInDom: ImageDecoder = (file) =>
  new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      // Clear the handlers before the src, so a late error event on the
      // torn-down element cannot reject an already-settled promise.
      img.onload = null;
      img.onerror = null;
      img.src = '';
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { release(); reject(new Error('That picture could not be opened. Please try another one.')); };
    img.onload = () => resolve({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      encode(width, height, mimeType, quality) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser could not process that picture. Please try another one.');
        // A fresh canvas is transparent and JPEG has no alpha, so every
        // untouched pixel would encode as black. White matches the card.
        if (mimeType === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL(mimeType, quality);
      },
      release,
    });
    img.src = url;
  });

/**
 * Read a picked file, downscale it and return the `data:image/...` string to
 * store on a card. Every error message here is written to be shown verbatim to
 * the person who picked the file.
 *
 * SVG is refused on the way in even though `parseImage` admits
 * `data:image/svg+xml` on the way in from a file: an imported board may
 * legitimately carry one (it renders inert in an `<img>`), but there is no
 * reason to let this app *author* one.
 */
export async function fileToCardImage(
  file: File | null,
  opts: { maxDim?: number; quality?: number; maxChars?: number } = {},
  decode: ImageDecoder = decodeInDom,
): Promise<string> {
  const maxDim = opts.maxDim ?? MAX_IMAGE_DIM;
  const quality = opts.quality ?? IMAGE_QUALITY;
  const maxChars = opts.maxChars ?? MAX_IMAGE_CHARS;

  if (!file) throw new Error('No file was chosen.');
  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  if (!type.startsWith('image/')) throw new Error('That file is not a picture. Please choose a JPG, PNG or WebP.');
  if (type.startsWith('image/svg')) throw new Error('SVG pictures cannot be added to a card. Please choose a JPG, PNG or WebP instead.');
  if (file.size === 0) throw new Error('That picture file is empty. Please choose another one.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageTooLargeError(
      `That picture is too big to open (${formatSize(file.size)}). Please choose one under ${formatSize(MAX_UPLOAD_BYTES)}.`,
      file.size, MAX_UPLOAD_BYTES);
  }

  const decoded = await decode(file);
  let dataUri: string;
  try {
    const size = targetSize(decoded.width, decoded.height, maxDim);
    dataUri = decoded.encode(size.width, size.height, outputMimeType(type), quality);
  } finally {
    decoded.release();
  }

  // A blocked or empty canvas yields `"data:,"`, which would sail through as a
  // card picture and render as nothing.
  if (!dataUri.startsWith('data:image/')) throw new Error('That picture could not be prepared for the board. Please try another one.');
  if (dataUri.length > maxChars) {
    const advice = outputMimeType(type) === 'image/png'
      ? ' Pictures with transparent backgrounds stay PNGs, which are bulkier — saving it as a JPG usually fixes this.'
      : '';
    throw new ImageTooLargeError(
      `That picture is still too large after shrinking (${formatSize(dataUri.length)}, limit ${formatSize(maxChars)}).${advice}`,
      dataUri.length, maxChars);
  }
  return dataUri;
}
