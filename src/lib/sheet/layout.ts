/**
 * Zelvo answer sheet, layout version 1.
 *
 * Everything is measured in millimetres on an A4 page (210 × 297), origin at the top-left.
 * The scanner (stage 3) uses the same numbers: it finds the four corner squares, maps the
 * photo onto this page, reads the QR code, then checks each bubble's centre.
 * Changing any number here means making a new layout version — never edit version 1 in place.
 */
export const LAYOUT_VERSION = 1;

export const PAGE = { width: 210, height: 297 };

/** Solid black squares used to find and straighten the page. Centres listed TL, TR, BL, BR. */
export const MARKERS = {
  size: 7,
  centres: [
    [12, 12],
    [198, 12],
    [12, 285],
    [198, 285],
  ] as const,
};

/** QR code with the exam, student and page (see sheetCode). Quiet zone included in `size`. */
export const QR = { x: 166, y: 20, size: 28 };

/** Boxes students write in on blank sheets (read by the handwriting AI in stage 6). */
export const WRITE_BOXES = {
  name: { x: 12, y: 50, w: 146, h: 12 },
  className: { x: 12, y: 66, w: 70, h: 11 },
  subject: { x: 88, y: 66, w: 70, h: 11 },
};

export const GRID = {
  top: 96, // top edge of the first row
  left: 12,
  right: 198,
  rowsPerColumn: 25,
  rowsPerBlock: 5,
  rowHeight: 6.6,
  blockGap: 2.6,
  numberWidth: 9,
  bubblePitch: 6.2,
  bubbleDiameter: 4.6,
  columnGap: 4,
};

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type GridShape = {
  columns: number;
  perPage: number;
  columnWidth: number;
  /** Left edge of the first column (the grid is centred). */
  startX: number;
};

export function gridShape(optionCount: number): GridShape {
  const g = GRID;
  const columnWidth = g.numberWidth + optionCount * g.bubblePitch + g.columnGap;
  const usable = g.right - g.left;
  const columns = Math.floor((usable + g.columnGap) / columnWidth);
  const gridWidth = columns * columnWidth - g.columnGap;
  return {
    columns,
    perPage: columns * g.rowsPerColumn,
    columnWidth,
    startX: g.left + (usable - gridWidth) / 2,
  };
}

export function pageCount(questionCount: number, optionCount: number): number {
  return Math.max(1, Math.ceil(questionCount / gridShape(optionCount).perPage));
}

/** Questions on a page, 1-based and inclusive. */
export function pageRange(page: number, questionCount: number, optionCount: number) {
  const { perPage } = gridShape(optionCount);
  const first = (page - 1) * perPage + 1;
  return { first, last: Math.min(questionCount, page * perPage) };
}

/** Where question `index` (0-based within its page) sits. */
export function rowPosition(indexOnPage: number, shape: GridShape) {
  const g = GRID;
  const column = Math.floor(indexOnPage / g.rowsPerColumn);
  const row = indexOnPage % g.rowsPerColumn;
  const block = Math.floor(row / g.rowsPerBlock);
  const x = shape.startX + column * shape.columnWidth;
  const centreY = g.top + row * g.rowHeight + block * g.blockGap + g.rowHeight / 2;
  return { column, row, x, centreY };
}

/** Centre of a bubble: question index on the page and option index (0 = A). */
export function bubbleCentre(indexOnPage: number, option: number, shape: GridShape) {
  const { x, centreY } = rowPosition(indexOnPage, shape);
  return { x: x + GRID.numberWidth + option * GRID.bubblePitch + GRID.bubblePitch / 2, y: centreY };
}

/**
 * Text stored in the QR code: "ZLV1:<exam>:<student or 0>:<page>:<pages>".
 * IDs are written as 32 upper-case hex characters so the code stays small (QR alphanumeric mode).
 */
export function sheetCode(examId: string, studentId: string | null, page: number, pages: number) {
  const hex = (id: string) => id.replace(/-/g, '').toUpperCase();
  return `ZLV${LAYOUT_VERSION}:${hex(examId)}:${studentId ? hex(studentId) : '0'}:${page}:${pages}`;
}
