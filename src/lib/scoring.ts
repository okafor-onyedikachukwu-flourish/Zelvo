import { FREE, UNSET } from './exams';

export type ScriptScore = {
  score: number;
  /** Highest possible score with the answer key as it is now. */
  outOf: number;
  percent: number;
  /** Score converted to the exam's "record out of" total, if set. */
  recorded: number | null;
  /** Answers Zelvo wasn't sure about, or with more than one bubble shaded. */
  toCheck: number;
  /** Questions on pages that haven't been scanned. */
  missing: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreScript(answers: string, key: string, mark: number, recordOutOf: number | null): ScriptScore {
  let right = 0;
  let counted = 0;
  let toCheck = 0;
  let missing = 0;
  for (let i = 0; i < key.length; i++) {
    const k = key[i];
    const a = answers[i] ?? UNSET;
    if (a === UNSET) missing++;
    else if (a === '#' || (a >= 'a' && a <= 'f')) toCheck++;
    if (k === UNSET) continue; // not in the key yet: doesn't count either way
    counted++;
    if (k === FREE || a.toUpperCase() === k) right++;
  }
  const score = right * mark;
  const outOf = counted * mark;
  const percent = outOf > 0 ? (score / outOf) * 100 : 0;
  return {
    score: round1(score),
    outOf: round1(outOf),
    percent: round1(percent),
    recorded: recordOutOf && outOf > 0 ? round1((score / outOf) * recordOutOf) : null,
    toCheck,
    missing,
  };
}

/** What a stored answer character means, for display. */
export function describeAnswer(a: string): string {
  if (a === '-') return 'Blank';
  if (a === '#') return 'More than one';
  if (a === UNSET) return 'Not scanned';
  return a.toUpperCase();
}
