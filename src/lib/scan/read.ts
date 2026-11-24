import jsQR from 'jsqr';
import { LAYOUT_VERSION, MARKERS, PAGE, bubbleCentre, gridShape, pageCount, pageRange } from '../sheet/layout';
import { homography, project, sample, type Gray, type Homography, type Point } from './geometry';
import { findCornerMarkers } from './markers';

/**
 * Answer characters, one per question:
 *  A–F  a confident answer
 *  a–f  Zelvo's best guess, but the teacher should check it (faint, partly rubbed out…)
 *  -    left blank
 *  #    more than one bubble shaded
 *  ?    not scanned yet (page missing)
 */
export type SheetCode = { examId: string; studentId: string | null; page: number; pages: number };

export type SheetRead = {
  code: SheetCode;
  /** First question number on this page (1-based) and the answers for this page's questions. */
  first: number;
  answers: string;
  /** Page millimetres → photo pixels. */
  toImage: Homography;
};

export type ReadFailure =
  | { reason: 'no-markers' }
  | { reason: 'no-code' }
  | { reason: 'other-exam'; code: SheetCode }
  | { reason: 'changed'; code: SheetCode };

export type ReadOutcome = ({ ok: true } & SheetRead) | ({ ok: false } & ReadFailure);

export function parseSheetCode(text: string): SheetCode | null {
  const m = /^ZLV(\d+):([0-9A-F]{32}):([0-9A-F]{32}|0):(\d+):(\d+)$/.exec(text.trim());
  if (!m || Number(m[1]) !== LAYOUT_VERSION) return null;
  const uuid = (h: string) =>
    `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toLowerCase();
  return { examId: uuid(m[2]), studentId: m[3] === '0' ? null : uuid(m[3]), page: Number(m[4]), pages: Number(m[5]) };
}

/** Reads one photographed page of a Zelvo answer sheet. */
export function readSheet(
  g: Gray,
  exam: { id: string; questionCount: number; optionCount: number },
): ReadOutcome {
  const found = findCornerMarkers(g);
  if (!found) return { ok: false, reason: 'no-markers' };
  const [tl, tr, bl, br] = found;
  const pageCorners = MARKERS.centres.map(([x, y]) => [x, y] as Point);

  // Try the page upright first, then the other ways round. The QR code tells us which is right.
  const landscape = g.width > g.height;
  const turns: Point[][] = [
    [tl, tr, bl, br], // upright
    [br, bl, tr, tl], // upside down
    [tr, br, tl, bl], // top of the page on the right of the photo
    [bl, tl, br, tr], // top of the page on the left of the photo
  ];
  const order = landscape ? [2, 3, 0, 1] : [0, 1, 2, 3];
  let toImage: Homography | null = null;
  let code: SheetCode | null = null;
  for (const t of order) {
    const h = homography(pageCorners, turns[t]);
    const text = decodeQr(g, h);
    const parsed = text ? parseSheetCode(text) : null;
    if (parsed) {
      toImage = h;
      code = parsed;
      break;
    }
  }
  if (!toImage || !code) return { ok: false, reason: 'no-code' };
  if (code.examId !== exam.id) return { ok: false, reason: 'other-exam', code };
  if (code.pages !== pageCount(exam.questionCount, exam.optionCount) || code.page > code.pages) {
    return { ok: false, reason: 'changed', code };
  }

  const { first, last } = pageRange(code.page, exam.questionCount, exam.optionCount);
  const answers = readBubbles(g, toImage, last - first + 1, exam.optionCount);
  return { ok: true, code, first, answers, toImage };
}

/** Straightens the QR area of the page and decodes it. */
function decodeQr(g: Gray, h: Homography): string | null {
  const x0 = 163;
  const y0 = 17;
  const sizeMm = 34;
  const ppm = 7;
  const n = sizeMm * ppm;
  const rgba = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [px, py] = project(h, x0 + (i + 0.5) / ppm, y0 + (j + 0.5) / ppm);
      const v = sample(g, px, py);
      const k = (j * n + i) * 4;
      rgba[k] = rgba[k + 1] = rgba[k + 2] = v;
      rgba[k + 3] = 255;
    }
  }
  const result = jsQR(rgba, n, n, { inversionAttempts: 'dontInvert' });
  return result?.data ?? null;
}

// Sample points inside a bubble (radius 1.5 mm) and on a ring of paper around it (radius 3 mm).
const INSIDE: Point[] = [];
for (let dy = -1.5; dy <= 1.5; dy += 0.375) {
  for (let dx = -1.5; dx <= 1.5; dx += 0.375) if (dx * dx + dy * dy <= 1.5 * 1.5) INSIDE.push([dx, dy]);
}
const RING: Point[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return [Math.cos(a) * 3, Math.sin(a) * 3] as Point;
});

/** How dark each bubble is, from 0 (empty paper) to 1 (black). */
export function bubbleDarkness(g: Gray, toImage: Homography, count: number, optionCount: number): number[][] {
  const shape = gridShape(optionCount);
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const row: number[] = [];
    for (let o = 0; o < optionCount; o++) {
      const c = bubbleCentre(i, o, shape);
      let inside = 0;
      for (const [dx, dy] of INSIDE) {
        const [px, py] = project(toImage, c.x + dx, c.y + dy);
        inside += sample(g, px, py);
      }
      inside /= INSIDE.length;
      const ring = RING.map(([dx, dy]) => {
        const [px, py] = project(toImage, c.x + dx, c.y + dy);
        return sample(g, px, py);
      }).sort((a, b) => a - b);
      const paper = Math.max(ring[Math.floor(ring.length * 0.75)], 1);
      row.push(Math.min(1, Math.max(0, 1 - inside / paper)));
    }
    out.push(row);
  }
  return out;
}

/** Turns bubble darkness into answer characters, using levels measured on this page. */
export function classify(darkness: number[][]): string {
  // The lightest bubble of a question is almost always empty; the darkest is usually the answer.
  const mins = darkness.map((r) => Math.min(...r)).sort((a, b) => a - b);
  const empty = mins[Math.floor(mins.length * 0.5)] ?? 0;
  const maxes = darkness.map((r) => Math.max(...r)).sort((a, b) => a - b);
  const filled = maxes[Math.floor(maxes.length * 0.8)] ?? 0;
  // If almost nothing is shaded on the page, fall back to fixed levels.
  const span = filled - empty >= 0.25 ? filled - empty : 0.55;
  const low = empty + span * 0.35; // below this: not shaded
  const high = empty + span * 0.6; // above this: clearly shaded

  let out = '';
  for (const row of darkness) {
    const order = row.map((d, i) => [d, i] as const).sort((a, b) => b[0] - a[0]);
    const [d1, i1] = order[0];
    const d2 = order[1]?.[0] ?? 0;
    const letter = String.fromCharCode(65 + i1);
    if (d1 < low) out += '-';
    else if (d2 >= high) out += '#';
    else if (d1 >= high && d2 < low) out += letter;
    else out += letter.toLowerCase(); // faint mark, or a second mark that isn't clear: ask the teacher
  }
  return out;
}

function readBubbles(g: Gray, toImage: Homography, count: number, optionCount: number): string {
  return classify(bubbleDarkness(g, toImage, count, optionCount));
}

/** The page, straightened and cropped, at `ppm` pixels per millimetre (for keeping and reviewing). */
export function straighten(g: Gray, toImage: Homography, ppm = 4): Gray {
  const width = Math.round(PAGE.width * ppm);
  const height = Math.round(PAGE.height * ppm);
  const data = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const [px, py] = project(toImage, (i + 0.5) / ppm, (j + 0.5) / ppm);
      data[j * width + i] = sample(g, px, py);
    }
  }
  return { data, width, height };
}

export const READ_HINTS: Record<ReadFailure['reason'], string> = {
  'no-markers': "Couldn't find the four black squares. Fit the whole sheet in the photo, on a plain surface, with good light.",
  'no-code': "Found the sheet but couldn't read its code. Hold the phone steady and make sure the top-right corner is sharp and not in shadow.",
  'other-exam': 'This sheet belongs to a different exam.',
  changed: 'This sheet was printed before the exam’s number of questions or options was changed. Print new sheets.',
};

