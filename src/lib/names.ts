/**
 * Reads a list of people's names from pasted text or a CSV file.
 * Handles: one name per line, numbered lists ("1. Ada Obi"), text copied from
 * Excel/Google Sheets (tab-separated), and CSV files with or without a header row
 * (e.g. "S/N, Surname, First name, Other names").
 */
export function parseNames(text: string): string[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((l) => (delimiter ? splitRow(l, delimiter) : [l]));

  let pick: (row: string[]) => string;
  let body = rows;
  const header = headerColumns(rows[0]);
  if (header) {
    body = rows.slice(1);
    pick = (row) => {
      if (header.full !== -1) return row[header.full] ?? '';
      return header.parts.map((i) => row[i] ?? '').join(' ');
    };
  } else if (!delimiter) {
    // One name per line: drop numbering and any codes such as admission numbers.
    pick = (row) =>
      cleanName(row[0])
        .split(' ')
        .filter((w) => !/\d/.test(w))
        .join(' ');
  } else {
    // No header: keep cells that look like names (letters, no digits) and join them.
    pick = (row) =>
      row
        .map((c) => c.trim())
        .filter((c) => /\p{L}/u.test(c) && !/\d/.test(c))
        .join(' ');
  }

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of body) {
    const name = cleanName(pick(row));
    const key = name.toLowerCase();
    if (name.length < 2 || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Splits "JSS1A, JSS1B" or one-per-line input into separate names. */
export function splitList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const name = part.replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function cleanName(s: string): string {
  return s
    .replace(/^\s*\d+\s*[.)\-:]?\s+/, '') // leading "1." / "12)" numbering
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 10);
  for (const d of ['\t', ',', ';']) {
    const count = sample.filter((l) => l.includes(d)).length;
    if (count >= Math.ceil(sample.length / 2)) return d;
  }
  return null;
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function headerColumns(row: string[]): { full: number; parts: number[] } | null {
  const cells = row.map((c) => c.toLowerCase().replace(/[^a-z ]/g, '').trim());
  if (!cells.some((c) => /name|surname/.test(c))) return null;
  if (row.some((c) => /\d/.test(c) && !/^s\/?n$/i.test(c.trim()))) return null;

  const full = cells.findIndex((c) => /^(full ?name|names?|student ?names?|pupil ?names?|students?|teacher ?names?)$/.test(c));
  const surname = cells.findIndex((c) => /surname|last ?name|family ?name/.test(c));
  const first = cells.findIndex((c) => /first ?name|given ?name|fore ?name/.test(c));
  const other = cells.findIndex((c) => /other ?names?|middle ?names?/.test(c));
  const parts = [surname, first, other].filter((i) => i !== -1);
  if (full === -1 && parts.length === 0) return null;
  return { full, parts };
}
