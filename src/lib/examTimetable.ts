// The exam timetable: exam periods ("First term exams", 1–12 Dec) and the papers in them.
import { isoDate } from './alarms';
import { must, supabase } from './supabase';
import { minutes, type Named } from './timetable';

export type ExamPeriod = { id: string; name: string; starts_on: string; ends_on: string; lessons_stop: boolean };
export type ExamPaper = {
  id: string;
  exam_period_id: string;
  day: string;
  starts_at: string;
  ends_at: string;
  subject_id: string;
  class_id: string;
  paper: string | null;
  invigilator_id: string | null;
  room: string | null;
};

/** One paper written by one or more classes at the same time (one row per class in the database). */
export type Sitting = {
  key: string;
  ids: string[];
  day: string;
  starts_at: string;
  ends_at: string;
  subject_id: string;
  paper: string | null;
  invigilator_id: string | null;
  room: string | null;
  classIds: string[];
};

const PAPER_FIELDS = 'id, exam_period_id, day, starts_at, ends_at, subject_id, class_id, paper, invigilator_id, room';

export async function loadExamPeriods(schoolId: string, staffId: string) {
  const [periods, papers] = await Promise.all([
    supabase.from('exam_periods').select('id, name, starts_on, ends_on, lessons_stop').eq('school_id', schoolId).order('starts_on').then(must),
    supabase.from('exam_papers').select('exam_period_id, invigilator_id').eq('school_id', schoolId).then(must),
  ]);
  return (periods as ExamPeriod[]).map((p) => ({
    ...p,
    papers: papers.filter((x) => x.exam_period_id === p.id).length,
    mine: papers.filter((x) => x.exam_period_id === p.id && x.invigilator_id === staffId).length,
  }));
}

export async function loadExamPeriod(schoolId: string, periodId: string) {
  const [period, papers, classes, subjects, staff] = await Promise.all([
    supabase.from('exam_periods').select('id, name, starts_on, ends_on, lessons_stop').eq('id', periodId).maybeSingle().then(must),
    supabase.from('exam_papers').select(PAPER_FIELDS).eq('exam_period_id', periodId).order('day').order('starts_at').then(must),
    supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase.from('staff').select('id, full_name').eq('school_id', schoolId).not('user_id', 'is', null).order('full_name').then(must),
  ]);
  return {
    period: period as ExamPeriod | null,
    papers: papers as ExamPaper[],
    classes: classes as Named[],
    subjects: subjects as Named[],
    staff: staff.map((s) => ({ id: s.id, name: s.full_name })) as Named[],
  };
}
export type ExamPeriodData = Awaited<ReturnType<typeof loadExamPeriod>>;

/** Rows for the same paper at the same time, in the same room, with the same invigilator, shown as one. */
export function sittings(papers: ExamPaper[], classOrder: Named[] = []): Sitting[] {
  const map = new Map<string, Sitting>();
  for (const p of papers) {
    const key = [p.day, p.starts_at, p.ends_at, p.subject_id, p.paper ?? '', p.invigilator_id ?? '', (p.room ?? '').toLowerCase()].join('|');
    const s = map.get(key);
    if (s) {
      s.ids.push(p.id);
      s.classIds.push(p.class_id);
    } else {
      map.set(key, {
        key,
        ids: [p.id],
        day: p.day,
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        subject_id: p.subject_id,
        paper: p.paper,
        invigilator_id: p.invigilator_id,
        room: p.room,
        classIds: [p.class_id],
      });
    }
  }
  const rank = new Map(classOrder.map((c, i) => [c.id, i]));
  return [...map.values()]
    .map((s) => ({ ...s, classIds: s.classIds.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)) }))
    .sort((a, b) => (a.day === b.day ? minutes(a.starts_at) - minutes(b.starts_at) : a.day < b.day ? -1 : 1));
}

/** Every date from `from` to `to`, as "2026-12-01". */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split('-').map(Number);
  for (let i = 0; i < 70; i++) {
    const iso = isoDate(new Date(y, m - 1, d + i));
    if (iso > to) break;
    out.push(iso);
  }
  return out;
}

export const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "Tue 1 Dec" (or "Tuesday 1 December" with `long`). */
export function dateLabel(iso: string, long = false): string {
  const d = toDate(iso);
  try {
    return d.toLocaleDateString([], long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

/** "1 Dec – 12 Dec 2026". */
export function rangeLabel(from: string, to: string): string {
  const f = toDate(from);
  const t = toDate(to);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  try {
    return `${f.toLocaleDateString([], opts)} – ${t.toLocaleDateString([], { ...opts, year: 'numeric' })}`;
  } catch {
    return `${from} – ${to}`;
  }
}

/** Where an exam period is, compared with today. */
export function periodStatus(p: { starts_on: string; ends_on: string }, now = new Date()): { label: string; tone: 'primary' | 'warning' | 'neutral' | 'success' } {
  const t = isoDate(now);
  if (p.ends_on < t) return { label: 'Finished', tone: 'neutral' };
  if (p.starts_on <= t) return { label: 'On now', tone: 'warning' };
  const days = Math.round((toDate(p.starts_on).getTime() - toDate(t).getTime()) / 86_400_000);
  return { label: days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`, tone: days <= 7 ? 'primary' : 'success' };
}

/** "2 h", "1 h 30 min", "45 min". */
export function durationText(from: string, to: string): string {
  const m = minutes(to) - minutes(from);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`;
}
