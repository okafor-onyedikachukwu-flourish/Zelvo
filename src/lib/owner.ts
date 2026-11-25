// Data for the owner of Zelvo: totals, growth, activity, app versions and each school's setup.
// Counts only: no scores, answers or student names.
import { must, supabase } from './supabase';

export type Week = { week: string; schools: number; accounts: number; exams: number; scripts: number; active: number };
export type OwnerStats = {
  totals: {
    schools: number;
    suspended: number;
    accounts: number;
    staff: number;
    students: number;
    student_accounts: number;
    exams: number;
    scripts: number;
    lessons: number;
  };
  active: { today: number; week: number; month: number };
  weekly: Week[];
  builds: { build: number; users: number }[];
};

export type OwnerSchool = {
  id: string;
  name: string;
  country: string | null;
  timezone: string;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  heads: { name: string; title: string | null; email: string }[];
  counts: {
    classes: number;
    departments: number;
    staff: number;
    staff_requests: number;
    students: number;
    student_accounts: number;
    pending_students: number;
    exams: number;
    scripts: number;
    periods: number;
    lessons: number;
  };
  last_active: string | null;
  active_week: number;
};

export async function loadOwnerDashboard() {
  const [stats, schools, announcements] = await Promise.all([
    supabase.rpc('owner_stats').then(must),
    supabase.rpc('platform_overview').then(must),
    supabase.from('announcements').select('id, title, body, created_at, ends_at, stopped_at').order('created_at', { ascending: false }).limit(20).then(must),
  ]);
  return { stats: stats as unknown as OwnerStats, schools, announcements };
}

export async function loadOwnerSchool(id: string) {
  return (await supabase.rpc('owner_school', { p_school: id }).then(must)) as unknown as OwnerSchool;
}

const MILESTONES = [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

/** The next round number to aim for, and how far along the way we are (0–1). */
export function nextMilestone(value: number) {
  const next = MILESTONES.find((m) => m > value) ?? Math.ceil((value + 1) / 100000) * 100000;
  const prev = [...MILESTONES].reverse().find((m) => m <= value) ?? 0;
  return { next, prev, progress: next === prev ? 1 : (value - prev) / (next - prev) };
}

/** "today", "yesterday", "3 days ago", "12 Nov". */
export function sinceText(day: string | null): string {
  if (!day) return 'Not used yet';
  const then = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  const now = new Date();
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - then.getTime()) / 86400000);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 30) return `Active ${days} days ago`;
  return `Last active ${then.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Minutes of hand-marking a scanned script saves, for the "time saved" estimate. */
export const MINUTES_SAVED_PER_SCRIPT = 2;
