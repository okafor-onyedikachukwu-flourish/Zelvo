import type { Gray, Point } from './geometry';

type Blob = { area: number; cx: number; cy: number; w: number; h: number };

/**
 * Finds the four black corner squares of an answer sheet in a photo.
 * Returns their centres as they appear in the image: top-left, top-right, bottom-left, bottom-right
 * (image corners, not page corners: the page may be upside down or sideways).
 */
export function findCornerMarkers(full: Gray): Point[] | null {
  // Searching a half-size copy is four times quicker and still places the squares precisely enough.
  const factor = Math.max(full.width, full.height) > 1100 ? 2 : 1;
  const g = factor === 2 ? halfSize(full) : full;
  const found = findIn(g);
  return found ? found.map(([x, y]) => [x * factor + (factor - 1) / 2, y * factor + (factor - 1) / 2] as Point) : null;
}

function halfSize(g: Gray): Gray {
  const width = Math.floor(g.width / 2);
  const height = Math.floor(g.height / 2);
  const data = new Uint8Array(width * height);
  const src = g.data;
  const W = g.width;
  for (let y = 0; y < height; y++) {
    const r0 = 2 * y * W;
    const r1 = r0 + W;
    for (let x = 0; x < width; x++) {
      const c = 2 * x;
      data[y * width + x] = (src[r0 + c] + src[r0 + c + 1] + src[r1 + c] + src[r1 + c + 1] + 2) >> 2;
    }
  }
  return { data, width, height };
}

function findIn(g: Gray): Point[] | null {
  const blobs = darkBlobs(g);
  const { width: W, height: H } = g;
  const minDim = Math.min(W, H);
  const maxDim = Math.max(W, H);
  // A marker is 7 mm on a 210 mm page. The page fills somewhere between ~35% and ~100% of the photo.
  const minSide = ((7 * 0.35 * minDim) / 210) * 0.6;
  const maxSide = ((7 * 1.05 * maxDim) / 210) * 1.5;

  const candidates = blobs.filter((b) => {
    const side = Math.sqrt(b.area);
    if (side < minSide || side > maxSide) return false;
    const aspect = b.w / b.h;
    if (aspect < 0.6 || aspect > 1.65) return false;
    return b.area / (b.w * b.h) >= 0.5;
  });
  if (candidates.length < 4) return null;

  const corners: Point[] = [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ];
  const chosen: Blob[] = [];
  for (const [x, y] of corners) {
    let best: Blob | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      if (chosen.includes(c)) continue;
      const d = (c.cx - x) ** 2 + (c.cy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return null;
    chosen.push(best);
  }

  // The four squares should be roughly the same size and form a sensible four-sided shape.
  const areas = chosen.map((c) => c.area);
  if (Math.max(...areas) / Math.min(...areas) > 4) return null;
  const pts = chosen.map((c) => [c.cx, c.cy] as Point);
  const [tl, tr, bl, br] = pts;
  const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const top = dist(tl, tr);
  const bottom = dist(bl, br);
  const left = dist(tl, bl);
  const right = dist(tr, br);
  if (Math.min(top, bottom, left, right) < minDim * 0.25) return null;
  if (top / bottom > 1.8 || bottom / top > 1.8 || left / right > 1.8 || right / left > 1.8) return null;
  return pts;
}

/** Connected dark regions after a local (adaptive) threshold. Regions touching the photo's edge are ignored. */
function darkBlobs(g: Gray): Blob[] {
  const { data, width: W, height: H } = g;
  // Integral image for fast local averages.
  const iw = W + 1;
  const integral = new Uint32Array(iw * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += data[y * W + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + rowSum;
    }
  }
  const r = Math.max(15, Math.round(Math.min(W, H) / 14));
  const dark = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(W, x + r + 1);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = data[y * W + x];
      if (v < mean - 18 && v < mean * 0.8) dark[y * W + x] = 1;
    }
  }

  const blobs: Blob[] = [];
  const stack = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (dark[start] !== 1) continue;
    let top = 0;
    stack[top++] = start;
    dark[start] = 2;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = W;
    let maxX = 0;
    let minY = H;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top];
      const x = p % W;
      const y = (p - x) / W;
      area++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && dark[p - 1] === 1) {
        dark[p - 1] = 2;
        stack[top++] = p - 1;
      }
      if (x < W - 1 && dark[p + 1] === 1) {
        dark[p + 1] = 2;
        stack[top++] = p + 1;
      }
      if (y > 0 && dark[p - W] === 1) {
        dark[p - W] = 2;
        stack[top++] = p - W;
      }
      if (y < H - 1 && dark[p + W] === 1) {
        dark[p + W] = 2;
        stack[top++] = p + W;
      }
    }
    if (minX === 0 || minY === 0 || maxX === W - 1 || maxY === H - 1) continue;
    if (area < 30) continue;
    blobs.push({ area, cx: sx / area, cy: sy / area, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return blobs;
}
