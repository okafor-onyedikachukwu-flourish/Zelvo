// The school timetable: days, bell times (periods) and lessons, plus helpers to read them.
import { must, supabase } from './supabase';

export const DAYS = [
  { n: 1, short: 'Mon', long: 'Monday' },
  { n: 2, short: 'Tue', long: 'Tuesday' },
  { n: 3, short: 'Wed', long: 'Wednesday' },
  { n: 4, short: 'Thu', long: 'Thursday' },
  { n: 5, short: 'Fri', long: 'Friday' },
  { n: 6, short: 'Sat', long: 'Saturday' },
  { n: 7, short: 'Sun', long: 'Sunday' },
] as const;

export const dayName = (n: number) => DAYS.find((d) => d.n === n)?.long ?? '';
export const dayShort = (n: number) => DAYS.find((d) => d.n === n)?.short ?? '';

/** Today as 1 (Monday) … 7 (Sunday). */
export function today(now = new Date()): number {
  return ((now.getDay() + 6) % 7) + 1;
}

export type Period = { id: string; position: number; label: string; starts_at: string; ends_at: string; is_break: boolean };
export type Lesson = {
  id: string;
  day: number;
  period_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  room: string | null;
};
export type Named = { id: string; name: string };
export type Teacher = { id: string; name: string; subjectIds: string[] };

/** "08:40:00" → minutes after midnight. */
export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes after midnight → "08:40". */
export function hhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "08:40:00" → "8:40 AM" (or the phone's own style). */
export function formatTime(time: string): string {
  const mins = minutes(time);
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return hhmm(mins);
  }
}

export const timeRange = (p: { starts_at: string; ends_at: string }) => `${formatTime(p.starts_at)} – ${formatTime(p.ends_at)}`;

/** Everything needed to show or edit a school's timetable. */
export async function loadTimetable(schoolId: string) {
  const [school, periods, lessons, classes, subjects, staff, teaches] = await Promise.all([
    supabase.from('schools').select('school_days').eq('id', schoolId).single().then(must),
    supabase.from('periods').select('id, position, label, starts_at, ends_at, is_break').eq('school_id', schoolId).order('position').then(must),
    supabase.from('lessons').select('id, day, period_id, class_id, subject_id, teacher_id, room').eq('school_id', schoolId).then(must),
    supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase
      .from('staff')
      .select('id, full_name, role, subject_id')
      .eq('school_id', schoolId)
      .not('user_id', 'is', null)
      .order('full_name')
      .then(must),
    supabase.from('staff_subjects').select('staff_id, subject_id').eq('school_id', schoolId).then(must),
  ]);
  const teachers: Teacher[] = staff.map((s) => ({
    id: s.id,
    name: s.full_name,
    subjectIds: [...new Set([...teaches.filter((t) => t.staff_id === s.id).map((t) => t.subject_id), ...(s.subject_id ? [s.subject_id] : [])])],
  }));
  const days = [...(school.school_days ?? [1, 2, 3, 4, 5])].sort((a, b) => a - b);
  return { days, periods: periods as Period[], lessons: lessons as Lesson[], classes: classes as Named[], subjects: subjects as Named[], teachers };
}

export type TimetableData = Awaited<ReturnType<typeof loadTimetable>>;

/** The lesson in a slot, found quickly. */
export function slotKey(day: number, periodId: string, who: string) {
  return `${day}|${periodId}|${who}`;
}

/** The next lesson (from now) in a list, with how many minutes until it starts. */
export function nextLesson<T extends { day: number; starts_at: string; ends_at: string }>(
  lessons: T[],
  schoolDays: number[],
  now = new Date(),
): { lesson: T; inMinutes: number; isNow: boolean } | null {
  if (lessons.length === 0) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const d0 = today(now);
  for (let offset = 0; offset < 8; offset++) {
    const day = ((d0 - 1 + offset) % 7) + 1;
    if (!schoolDays.includes(day)) continue;
    const todays = lessons
      .filter((l) => l.day === day)
      .sort((a, b) => minutes(a.starts_at) - minutes(b.starts_at));
    for (const l of todays) {
      const start = minutes(l.starts_at) + offset * 1440;
      const end = minutes(l.ends_at) + offset * 1440;
      if (end > nowMins) return { lesson: l, inMinutes: start - nowMins, isNow: start <= nowMins };
    }
  }
  return null;
}

/** "in 25 min", "in 3 h", "tomorrow", "on Monday". */
export function whenText(inMinutes: number, day: number, now = new Date()): string {
  if (inMinutes <= 0) return 'Now';
  if (inMinutes < 60) return `In ${inMinutes} min`;
  const d0 = today(now);
  if (day === d0 && inMinutes < 24 * 60) return `In ${Math.round(inMinutes / 60)} h`;
  if (day === (d0 % 7) + 1) return 'Tomorrow';
  return dayName(day);
}

/** Bell times from a few choices: first lesson, lesson length, how many, and breaks after some lessons. */
export function generatePeriods(opts: {
  start: string;
  lessonMinutes: number;
  lessons: number;
  breaks: { after: number; minutes: number; label: string }[];
}) {
  const out: { label: string; starts_at: string; ends_at: string; is_break: boolean }[] = [];
  let t = minutes(opts.start);
  for (let i = 1; i <= opts.lessons; i++) {
    out.push({ label: `Period ${i}`, starts_at: hhmm(t), ends_at: hhmm(t + opts.lessonMinutes), is_break: false });
    t += opts.lessonMinutes;
    for (const b of opts.breaks) {
      if (b.after === i && b.minutes > 0 && i < opts.lessons) {
        out.push({ label: b.label, starts_at: hhmm(t), ends_at: hhmm(t + b.minutes), is_break: true });
        t += b.minutes;
      }
    }
  }
  return out;
}

/** Lowercase, no spaces or punctuation: "JSS 1A" = "jss1a". */
export function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Same words in any order: "OBI Emeka" = "emeka obi". */
export function personKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['mr', 'mrs', 'ms', 'miss', 'dr', 'sir', 'madam', 'prof'].includes(w))
    .sort()
    .join(' ');
}
