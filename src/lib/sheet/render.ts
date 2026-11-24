import makeQr from 'qrcode-generator';
import {
  GRID,
  MARKERS,
  OPTION_LETTERS,
  PAGE,
  QR,
  WRITE_BOXES,
  bubbleCentre,
  gridShape,
  pageCount,
  pageRange,
  rowPosition,
  sheetCode,
} from './layout';

export type SheetExam = {
  id: string;
  title: string;
  examDate: string | null;
  questionCount: number;
  optionCount: number;
  markPerQuestion: number;
  className: string;
  subjectName: string;
  schoolName: string;
};

export type SheetStudent = { id: string; name: string };

const FONT = "Roboto, 'Helvetica Neue', Arial, sans-serif";
const INK = '#111827';
const MUTED = '#4B5563';
const FAINT = '#9CA3AF';

/** Complete HTML for printing: one A4 page per sheet page, each drawn as an SVG in millimetres. */
export function sheetsHtml(exam: SheetExam, students: SheetStudent[] | null, blankCopies = 1): string {
  const pages = pageCount(exam.questionCount, exam.optionCount);
  const svgs: string[] = [];
  if (students && students.length > 0) {
    for (const s of students) {
      for (let p = 1; p <= pages; p++) svgs.push(pageSvg(exam, s, p, pages, false));
    }
  } else {
    const set: string[] = [];
    for (let p = 1; p <= pages; p++) set.push(pageSvg(exam, null, p, pages, false));
    for (let c = 0; c < Math.max(1, blankCopies); c++) svgs.push(...set);
  }
  // Bubble shapes are defined once and reused, which keeps big batches (a whole class) small.
  const defs = `<svg width="0" height="0" style="position:absolute">${bubbleDefs(exam.optionCount)}</svg>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  svg { display: block; width: 210mm; height: 297mm; }
</style></head>
<body>${defs}${svgs.map((s) => `<div class="page">${s}</div>`).join('')}</body></html>`;
}

/** One page as an SVG whose units are millimetres. Exported for previews and tests. */
export function pageSvg(
  exam: SheetExam,
  student: SheetStudent | null,
  page: number,
  pages: number,
  standalone = true,
): string {
  const out: string[] = [];
  if (standalone) out.push(bubbleDefs(exam.optionCount));
  const shape = gridShape(exam.optionCount);
  const { first, last } = pageRange(page, exam.questionCount, exam.optionCount);

  // Corner squares.
  const h = MARKERS.size / 2;
  for (const [cx, cy] of MARKERS.centres) {
    out.push(`<rect x="${n(cx - h)}" y="${n(cy - h)}" width="${MARKERS.size}" height="${MARKERS.size}" fill="#000"/>`);
  }

  // Header text.
  const letters = OPTION_LETTERS.slice(0, exam.optionCount);
  const details = [exam.subjectName, exam.className, formatDate(exam.examDate)].filter(Boolean).join('  ·  ');
  const marks = `${exam.questionCount} ${exam.questionCount === 1 ? 'question' : 'questions'}  ·  options ${letters[0]}–${letters[letters.length - 1]}  ·  ${formatMark(exam.markPerQuestion)} each`;
  out.push(text(20, 15.2, `ZELVO ANSWER SHEET  ·  ${clip(exam.schoolName, 60)}`, 2.7, MUTED, 'bold', 'start', 0.25));
  out.push(text(20, 23.5, clip(exam.title, 46), 5.6, INK, 'bold'));
  out.push(text(20, 30.5, clip(details, 70), 3.6, INK));
  out.push(text(20, 36.5, marks, 3.1, MUTED));
  out.push(
    text(20, 42.5, `Page ${page} of ${pages}  ·  questions ${first}–${last}`, 3.1, pages > 1 ? INK : MUTED, pages > 1 ? 'bold' : 'normal'),
  );

  // QR code with the exam, student and page.
  out.push(qrSvg(sheetCode(exam.id, student?.id ?? null, page, pages)));
  out.push(text(QR.x + QR.size / 2, QR.y + QR.size + 3, 'Scan with Zelvo', 2.4, MUTED, 'normal', 'middle'));

  // Who the sheet belongs to.
  const { name, className, subject } = WRITE_BOXES;
  if (student) {
    out.push(box(name.x, name.y, name.w, name.h, '#F3F4F6'));
    out.push(text(name.x + 2, name.y + 3.6, 'NAME', 2.4, MUTED, 'bold', 'start', 0.2));
    out.push(text(name.x + 2, name.y + 9.6, clip(student.name, 44), 5, INK, 'bold'));
    out.push(box(className.x, className.y, className.w, className.h, '#F3F4F6'));
    out.push(text(className.x + 2, className.y + 3.6, 'CLASS', 2.4, MUTED, 'bold', 'start', 0.2));
    out.push(text(className.x + 2, className.y + 8.8, clip(exam.className, 30), 3.8, INK));
    out.push(box(subject.x, subject.y, subject.w, subject.h, '#F3F4F6'));
    out.push(text(subject.x + 2, subject.y + 3.6, 'SUBJECT', 2.4, MUTED, 'bold', 'start', 0.2));
    out.push(text(subject.x + 2, subject.y + 8.8, clip(exam.subjectName, 30), 3.8, INK));
  } else {
    out.push(box(name.x, name.y, name.w, name.h));
    out.push(text(name.x + 2, name.y + 3.6, 'FULL NAME', 2.4, MUTED, 'bold', 'start', 0.2));
    out.push(box(className.x, className.y, className.w, className.h));
    out.push(text(className.x + 2, className.y + 3.6, 'CLASS', 2.4, MUTED, 'bold', 'start', 0.2));
    out.push(box(subject.x, subject.y, subject.w, subject.h));
    out.push(text(subject.x + 2, subject.y + 3.6, 'SUBJECT', 2.4, MUTED, 'bold', 'start', 0.2));
  }

  // Instructions, with a drawn example of a correctly shaded bubble.
  out.push(`<circle cx="22.3" cy="83" r="${GRID.bubbleDiameter / 2}" fill="#111"/>`);
  out.push(text(27, 84, 'Shade ONE bubble fully for each question, like this. Use a dark pencil or pen.', 3, INK));
  out.push(text(27, 89, 'To change an answer, rub it out completely. Keep the black squares and the code clean.', 3, MUTED));

  // Answer grid.
  for (let c = 0; c < shape.columns; c++) {
    const firstIndex = c * GRID.rowsPerColumn;
    if (first + firstIndex > last) break;
    letters.forEach((l, o) => {
      const { x } = bubbleCentre(firstIndex, o, shape);
      out.push(text(x, GRID.top - 1.6, l, 2.8, MUTED, 'bold', 'middle'));
    });
  }
  for (let q = first; q <= last; q++) {
    const i = q - first;
    const { x, centreY, row } = rowPosition(i, shape);
    if (Math.floor(row / GRID.rowsPerBlock) % 2 === 1 && row % GRID.rowsPerBlock === 0) {
      // Light band behind every other block of five rows, to help students keep their place.
      const rows = Math.min(GRID.rowsPerBlock, last - q + 1);
      const top = centreY - GRID.rowHeight / 2 - 0.4;
      out.push(
        `<rect x="${n(x - 0.8)}" y="${n(top)}" width="${n(shape.columnWidth - GRID.columnGap + 1.6)}" height="${n(rows * GRID.rowHeight + 0.8)}" rx="1" fill="#F3F4F6"/>`,
      );
    }
    out.push(text(x + GRID.numberWidth - 1.4, centreY + 1.05, String(q), 3, INK, 'bold', 'end'));
    letters.forEach((l, o) => {
      const c = bubbleCentre(i, o, shape);
      out.push(`<use href="#zb-${l}" x="${n(c.x)}" y="${n(c.y)}"/>`);
    });
  }

  // Footer.
  out.push(text(20, 277.5, `Zelvo  ·  layout 1  ·  ${exam.id.slice(0, 8)}`, 2.4, FAINT));
  out.push(text(190, 277.5, `Page ${page} of ${pages}`, 2.6, MUTED, 'bold', 'end'));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.width} ${PAGE.height}" width="210mm" height="297mm" font-family="${FONT}"><rect width="${PAGE.width}" height="${PAGE.height}" fill="#fff"/>${out.join('')}</svg>`;
}

/** An empty bubble with its letter, centred on (0, 0). */
function bubbleDefs(optionCount: number): string {
  const r = GRID.bubbleDiameter / 2;
  const shapes = OPTION_LETTERS.slice(0, optionCount).map(
    (l) =>
      `<g id="zb-${l}"><circle r="${r}" fill="#fff" stroke="#374151" stroke-width="0.25"/>` +
      `<text y="0.78" font-size="2.2" fill="${FAINT}" text-anchor="middle" font-family="${FONT}">${l}</text></g>`,
  );
  return `<defs>${shapes.join('')}</defs>`;
}

function qrSvg(data: string): string {
  const qr = makeQr(0, 'M');
  qr.addData(data, 'Alphanumeric');
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const total = count + quiet * 2;
  // Drawn on its own grid of whole modules (1 unit = 1 module), so there are no gaps between squares.
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return `<svg x="${QR.x}" y="${QR.y}" width="${QR.size}" height="${QR.size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

function box(x: number, y: number, w: number, h: number, fill = '#fff') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="${fill}" stroke="#6B7280" stroke-width="0.3"/>`;
}

function text(
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight: 'normal' | 'bold' = 'normal',
  anchor: 'start' | 'middle' | 'end' = 'start',
  spacing = 0,
) {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}"${
    spacing ? ` letter-spacing="${spacing}"` : ''
  }>${escapeXml(value)}</text>`;
}

function n(v: number) {
  return Math.round(v * 100) / 100;
}

function clip(s: string, max: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

export function formatMark(mark: number): string {
  const v = Number.isInteger(mark) ? String(mark) : String(mark);
  return `${v} ${mark === 1 ? 'mark' : 'marks'}`;
}
