import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { rgbaToGray, type Gray } from './geometry';

/** Longest side, in pixels, that photos are reduced to before reading. Enough for every sheet layout. */
const MAX_SIDE = 1600;

/** Loads a photo as a greyscale image, reduced in size so it reads quickly on any phone. */
export async function loadPhoto(uri: string, width: number, height: number): Promise<Gray> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo.');
  const decoded = jpeg.decode(base64ToBytes(saved.base64), { useTArray: true, maxMemoryUsageInMB: 256 });
  return rgbaToGray(decoded.data, decoded.width, decoded.height);
}

/** Saves a greyscale image as a JPEG in the app's own storage and returns the file's URI. */
export function saveGrayJpeg(g: Gray, name: string, quality = 70): string {
  const rgba = new Uint8Array(g.width * g.height * 4);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) {
    rgba[j] = rgba[j + 1] = rgba[j + 2] = g.data[i];
    rgba[j + 3] = 255;
  }
  const bytes = encodeJpeg({ data: rgba, width: g.width, height: g.height }, quality);
  const dir = new Directory(Paths.document, 'scans');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.write(bytes);
  return file.uri;
}

/**
 * jpeg-js returns `Buffer.from(bytes)` when bundled, and React Native has no `Buffer`.
 * A tiny stand-in is enough: the encoder only uses it to turn its byte list into an array.
 */
function encodeJpeg(image: { data: Uint8Array; width: number; height: number }, quality: number): Uint8Array {
  const g = globalThis as { Buffer?: unknown };
  const hadBuffer = g.Buffer !== undefined;
  if (!hadBuffer) g.Buffer = { from: (list: ArrayLike<number>) => Uint8Array.from(list) };
  try {
    return new Uint8Array(jpeg.encode(image, quality).data);
  } finally {
    if (!hadBuffer) delete g.Buffer;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
