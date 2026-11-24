import { OPTION_LETTERS } from './sheet/layout';

/** Answer keys are stored as one character per question: a letter, '?' (not set) or '*' (free mark). */
export const UNSET = '?';
export const FREE = '*';

export const MAX_QUESTIONS = 1000;

export function lettersFor(optionCount: number): string[] {
  return OPTION_LETTERS.slice(0, optionCount);
}

export function optionsLabel(optionCount: number): string {
  const l = lettersFor(optionCount);
  return `${l[0]}–${l[l.length - 1]}`;
}

export function keyProgress(key: string): { set: number; total: number } {
  let set = 0;
  for (const ch of key) if (ch !== UNSET) set++;
  return { set, total: key.length };
}

/**
 * Fits an existing key to a new number of questions and options:
 * extra questions start unset, removed ones are dropped, and letters that no longer exist become unset.
 */
export function resizeKey(key: string, questionCount: number, optionCount: number): string {
  const allowed = new Set([...lettersFor(optionCount), FREE]);
  let out = '';
  for (let i = 0; i < questionCount; i++) {
    const ch = key[i] ?? UNSET;
    out += allowed.has(ch) ? ch : UNSET;
  }
  return out;
}

/**
 * Reads a typed or pasted key such as "ABDC CADB", "1A 2C 3B" or "1. a, 2. c".
 * Keeps only option letters (and * for a free mark), in order.
 */
export function parseTypedKey(text: string, optionCount: number): string {
  const allowed = new Set([...lettersFor(optionCount), FREE]);
  let out = '';
  for (const ch of text.toUpperCase()) if (allowed.has(ch)) out += ch;
  return out;
}

export function formatMarks(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `${v} ${v === 1 ? 'mark' : 'marks'}`;
}
