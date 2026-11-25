// Lesson alarms: a full-screen alarm (like a clock alarm) a few minutes before each lesson a teacher
// teaches, and before each exam paper they invigilate. Alarms are set on the phone for the next four
// weeks, so they ring with no internet; every time Zelvo opens they're brought up to date.
// During an exam period that stops normal lessons, lesson alarms pause and invigilation alarms ring.
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
  type Notification,
  type TimestampTrigger,
} from 'react-native-notify-kit';
import { Platform } from 'react-native';
import { ALARM_MARKER, AlarmWindow } from '../../modules/alarm-window';
import { colors } from '../components/theme';
import { must, supabase } from './supabase';
import { formatTime, minutes, today } from './timetable';

export const ALARM_CHANNEL = 'zelvo-lesson-alarms-v1';
const REMINDER_CHANNEL = 'zelvo-reminders-v1';
const PREFIX = 'zelvo-';
const SNOOZE_PREFIX = 'zelvo-snooze-';
const REMINDER_ID = 'zelvo-keep-alarms';
export const TEST_ALARM_ID = 'zelvo-test-alarm';

/** How far ahead alarms are set, and the most at once (Android allows about 500 per app). */
const WINDOW_DAYS = 28;
const MAX_ALARMS = 180;
export const SNOOZE_MINUTES = 5;
/** An alarm nobody stops goes quiet after this long. */
const RING_MINUTES = 5;

export const LEAD_CHOICES = [0, 2, 5, 10, 15] as const;
export const leadLabel = (lead: number) => (lead === 0 ? 'When it starts' : `${lead} min before`);

// ===== Settings (per phone) =====

export type AlarmSettings = {
  enabled: boolean;
  /** Minutes before the lesson starts. */
  lead: number;
  /** On holiday: no alarms before this date ("2027-01-05"). */
  resumeOn: string | null;
};
const SETTINGS_KEY = 'zelvo.alarms.settings.v1';
const DEFAULT_SETTINGS: AlarmSettings = { enabled: true, lead: 5, resumeOn: null };

export async function getAlarmSettings(): Promise<AlarmSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw) as Partial<AlarmSettings>;
    return {
      enabled: s.enabled !== false,
      lead: typeof s.lead === 'number' && s.lead >= 0 && s.lead <= 30 ? s.lead : DEFAULT_SETTINGS.lead,
      resumeOn: typeof s.resumeOn === 'string' && s.resumeOn > isoDate(new Date()) ? s.resumeOn : null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAlarmSettings(s: AlarmSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ===== What the alarms are made from (kept on the phone for offline use) =====

type LessonSource = {
  school: string;
  day: number;
  position: number;
  starts: string;
  ends: string;
  subject: string;
  className: string;
  room: string | null;
};
type PaperSource = {
  school: string;
  date: string;
  starts: string;
  ends: string;
  subject: string;
  paper: string | null;
  className: string;
  room: string | null;
};
type PauseSource = { school: string; from: string; to: string; name: string };
export type AlarmSources = { userId: string; fetchedAt: number; lessons: LessonSource[]; papers: PaperSource[]; pauses: PauseSource[] };

export type StaffPlace = { staffId: string; schoolId: string; suspended: boolean };

const sourcesKey = (userId: string) => `zelvo.alarms.sources.${userId}`;
const SIGNATURE_KEY = 'zelvo.alarms.signature.v1';

/** "2026-12-01" for a date on the phone's calendar. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchSources(userId: string, places: StaffPlace[]): Promise<AlarmSources> {
  const from = isoDate(new Date());
  const out: AlarmSources = { userId, fetchedAt: Date.now(), lessons: [], papers: [], pauses: [] };
  for (const place of places) {
    if (place.suspended) continue;
    const school = place.schoolId;
    const [periods, lessons, subjects, classes, examPeriods, papers] = await Promise.all([
      supabase.from('periods').select('id, position, starts_at, ends_at').eq('school_id', school).then(must),
      supabase.from('lessons').select('day, period_id, class_id, subject_id, room').eq('school_id', school).eq('teacher_id', place.staffId).then(must),
      supabase.from('subjects').select('id, name').eq('school_id', school).then(must),
      supabase.from('classes').select('id, name').eq('school_id', school).then(must),
      supabase.from('exam_periods').select('name, starts_on, ends_on, lessons_stop').eq('school_id', school).gte('ends_on', from).then(must),
      supabase
        .from('exam_papers')
        .select('day, starts_at, ends_at, subject_id, class_id, paper, room')
        .eq('school_id', school)
        .eq('invigilator_id', place.staffId)
        .gte('day', from)
        .then(must),
    ]);
    const subject = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Lesson';
    const className = (id: string) => classes.find((c) => c.id === id)?.name ?? '';
    for (const l of lessons) {
      const p = periods.find((x) => x.id === l.period_id);
      if (!p) continue;
      out.lessons.push({
        school,
        day: l.day,
        position: p.position,
        starts: p.starts_at.slice(0, 5),
        ends: p.ends_at.slice(0, 5),
        subject: subject(l.subject_id),
        className: className(l.class_id),
        room: l.room,
      });
    }
    for (const e of examPeriods) {
      if (e.lessons_stop) out.pauses.push({ school, from: e.starts_on, to: e.ends_on, name: e.name });
    }
    for (const x of papers) {
      out.papers.push({
        school,
        date: x.day,
        starts: x.starts_at.slice(0, 5),
        ends: x.ends_at.slice(0, 5),
        subject: subject(x.subject_id),
        paper: x.paper,
        className: className(x.class_id),
        room: x.room,
      });
    }
  }
  return out;
}

/** Fresh from the internet when possible; otherwise what was saved last time. */
export async function loadAlarmSources(userId: string, places: StaffPlace[]): Promise<AlarmSources | null> {
  try {
    const fresh = await fetchSources(userId, places);
    await AsyncStorage.setItem(sourcesKey(userId), JSON.stringify(fresh));
    return fresh;
  } catch {
    try {
      const raw = await AsyncStorage.getItem(sourcesKey(userId));
      return raw ? (JSON.parse(raw) as AlarmSources) : null;
    } catch {
      return null;
    }
  }
}

// ===== Planning =====

export type PlannedAlarm = {
  id: string;
  kind: 'lesson' | 'exam';
  /** When it rings (ms). */
  at: number;
  /** When the lesson or paper starts (ms). */
  start: number;
  title: string;
  body: string;
};

const timeText = (hm: string) => formatTime(`${hm}:00`);
const joinNames = (names: string[]) => [...new Set(names.filter(Boolean))].join(', ');

/** Every alarm for the next few weeks, earliest first. */
export function planAlarms(src: AlarmSources, settings: AlarmSettings, now = Date.now(), days = WINDOW_DAYS): PlannedAlarm[] {
  if (!settings.enabled) return [];
  const out: PlannedAlarm[] = [];
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    const iso = isoDate(date);
    if (settings.resumeOn && iso < settings.resumeOn) continue;
    const weekday = today(date);
    const at = (hm: string) => {
      const m = minutes(hm);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), m % 60).getTime();
    };
    const paused = new Set(src.pauses.filter((p) => p.from <= iso && iso <= p.to).map((p) => p.school));

    // Lessons: one alarm for a double period (the same class and subject in back-to-back periods).
    const todays = src.lessons
      .filter((l) => l.day === weekday && !paused.has(l.school))
      .sort((a, b) => (a.school === b.school ? a.position - b.position : a.school < b.school ? -1 : 1));
    const merged: LessonSource[] = [];
    for (const l of todays) {
      const prev = merged[merged.length - 1];
      if (prev && prev.school === l.school && prev.position === l.position - 1 && prev.subject === l.subject && prev.className === l.className) {
        merged[merged.length - 1] = { ...prev, position: l.position, ends: l.ends };
      } else merged.push(l);
    }
    for (const l of merged) {
      const start = at(l.starts);
      out.push({
        id: `${PREFIX}lesson-${iso}-${l.starts.replace(':', '')}-${l.school.slice(0, 8)}`,
        kind: 'lesson',
        start,
        at: start - settings.lead * 60_000,
        title: `${l.subject} · ${l.className}`,
        body: [`${timeText(l.starts)} – ${timeText(l.ends)}`, l.room].filter(Boolean).join(' · '),
      });
    }

    // Exam papers you invigilate: classes in the same room at the same time are one alarm.
    const sittings = new Map<string, PaperSource[]>();
    for (const p of src.papers.filter((x) => x.date === iso)) {
      const key = `${p.school}|${p.starts}|${(p.room ?? '').toLowerCase()}`;
      sittings.set(key, [...(sittings.get(key) ?? []), p]);
    }
    for (const group of sittings.values()) {
      const first = group[0];
      const ends = group.map((g) => g.ends).sort().pop() ?? first.ends;
      const start = at(first.starts);
      const subjects = joinNames(group.map((g) => (g.paper ? `${g.subject} (${g.paper})` : g.subject)));
      out.push({
        id: `${PREFIX}exam-${iso}-${first.starts.replace(':', '')}-${first.school.slice(0, 8)}-${out.length}`,
        kind: 'exam',
        start,
        at: start - settings.lead * 60_000,
        title: `Invigilate ${subjects}`,
        body: [joinNames(group.map((g) => g.className)), `${timeText(first.starts)} – ${timeText(ends)}`, first.room].filter(Boolean).join(' · '),
      });
    }
  }
  return out
    .filter((a) => a.at > now + 15_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_ALARMS);
}

// ===== Notifications =====

function alarmNotification(id: string, title: string, body: string, data: Record<string, string>): Notification {
  return {
    id,
    title,
    body,
    data: { zelvo: 'alarm', ...data },
    android: {
      channelId: ALARM_CHANNEL,
      smallIcon: 'ic_zelvo_alarm',
      color: colors.primary,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      lightUpScreen: true,
      showTimestamp: true,
      timestamp: Number(data.start) || Date.now(),
      timeoutAfter: RING_MINUTES * 60_000,
      fullScreenAction: { id: 'default', mainComponent: ALARM_MARKER },
      pressAction: { id: 'default', mainComponent: ALARM_MARKER },
      actions: [
        { title: 'Stop', pressAction: { id: 'stop' } },
        { title: `Snooze ${SNOOZE_MINUTES} min`, pressAction: { id: 'snooze' } },
      ],
    },
  };
}

const exactTrigger = (timestamp: number): TimestampTrigger => ({
  type: TriggerType.TIMESTAMP,
  timestamp,
  alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
});

let channelsReady = false;
export async function ensureChannels() {
  if (channelsReady || Platform.OS !== 'android') return;
  const made = await AlarmWindow.createAlarmChannel(
    ALARM_CHANNEL,
    'Lesson alarms',
    'Rings before your lessons and the exams you invigilate.',
  );
  if (!made) {
    await notifee.createChannel({ id: ALARM_CHANNEL, name: 'Lesson alarms', importance: AndroidImportance.HIGH, sound: 'zelvo_alarm', vibration: true });
  }
  await notifee.createChannel({ id: REMINDER_CHANNEL, name: 'Reminders', importance: AndroidImportance.DEFAULT });
  channelsReady = true;
}

export const isAlarm = (n?: Notification) => n?.data?.zelvo === 'alarm';

/** Turns the plan into alarms on the phone, changing only what's needed. */
async function applyPlan(plan: PlannedAlarm[]) {
  // Alarms are set until the end of the window (or the last one, if there were too many to set).
  const day = 86_400_000;
  const coveredUntil = plan.length >= MAX_ALARMS ? plan[plan.length - 1].start : Date.now() + WINDOW_DAYS * day;
  const reminderAt = plan.length > 0 ? Math.max(Date.now() + day, coveredUntil - 3 * day) : 0;
  const signature = JSON.stringify([plan.map((a) => [a.id, a.at, a.title, a.body]), reminderAt > 0]);
  const existing = (await notifee.getTriggerNotificationIds()).filter((id) => id.startsWith(PREFIX) && !id.startsWith(SNOOZE_PREFIX) && id !== TEST_ALARM_ID);
  const have = new Set(existing);
  const soon = Date.now() + 60_000;
  const complete = plan.every((a) => a.at < soon || have.has(a.id));
  if (complete && (await AsyncStorage.getItem(SIGNATURE_KEY)) === signature) return;

  const wanted = new Set(plan.map((a) => a.id));
  const stale = existing.filter((id) => !wanted.has(id) && id !== REMINDER_ID);
  if (stale.length) await notifee.cancelTriggerNotifications(stale);

  await ensureChannels();
  for (let i = 0; i < plan.length; i += 20) {
    await Promise.all(
      plan.slice(i, i + 20).map((a) =>
        notifee.createTriggerNotification(
          alarmNotification(a.id, a.title, a.body, { kind: a.kind, start: String(a.start) }),
          exactTrigger(a.at),
        ),
      ),
    );
  }

  // If Zelvo isn't opened for weeks, the alarms would run out: a gentle reminder before they do.
  if (reminderAt > 0) {
    await notifee.createTriggerNotification(
      {
        id: REMINDER_ID,
        title: 'Open Zelvo to keep your lesson alarms',
        body: 'Your lesson alarms run out in a few days. Open Zelvo once and they carry on.',
        android: { channelId: REMINDER_CHANNEL, smallIcon: 'ic_zelvo_alarm', color: colors.primary, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: reminderAt },
    );
  } else {
    await notifee.cancelTriggerNotification(REMINDER_ID);
  }
  await AsyncStorage.setItem(SIGNATURE_KEY, signature);
}

let syncing: Promise<PlannedAlarm[]> | null = null;

/**
 * Brings the phone's alarms up to date for this account. With no account (logged out) every alarm
 * is removed, so the phone doesn't ring for someone who left it.
 */
export function syncAlarms(userId: string | null, places: StaffPlace[]): Promise<PlannedAlarm[]> {
  if (Platform.OS !== 'android') return Promise.resolve([]);
  const run = async () => {
    if (!userId || places.length === 0) {
      await clearAllAlarms();
      return [];
    }
    const [settings, src] = await Promise.all([getAlarmSettings(), loadAlarmSources(userId, places)]);
    if (!src || src.userId !== userId) return [];
    const plan = planAlarms(src, settings);
    await applyPlan(plan);
    return plan;
  };
  const next = (syncing ?? Promise.resolve([] as PlannedAlarm[])).catch(() => []).then(run);
  syncing = next;
  return next;
}

export async function clearAllAlarms() {
  const ids = (await notifee.getTriggerNotificationIds()).filter((id) => id.startsWith(PREFIX));
  if (ids.length) await notifee.cancelTriggerNotifications(ids);
  await AsyncStorage.removeItem(SIGNATURE_KEY);
}

/** Rings in a few seconds, to check the alarm works with the phone locked. */
export async function testAlarm(seconds = 10) {
  await ensureChannels();
  const start = Date.now() + seconds * 1000;
  await notifee.createTriggerNotification(
    alarmNotification(TEST_ALARM_ID, 'Test alarm · Zelvo', 'This is how your lesson alarms will ring.', { kind: 'test', start: String(start) }),
    exactTrigger(start),
  );
}

// ===== Stop and snooze =====

export async function stopAlarm(id: string) {
  await notifee.cancelNotification(id);
}

export async function snoozeAlarm(n: Notification) {
  if (!n.id) return;
  await notifee.cancelNotification(n.id);
  const id = n.id.startsWith(SNOOZE_PREFIX) ? n.id : `${SNOOZE_PREFIX}${n.id.slice(PREFIX.length)}`;
  const data = Object.fromEntries(Object.entries(n.data ?? {}).map(([k, v]) => [k, String(v)]));
  await ensureChannels();
  await notifee.createTriggerNotification(
    alarmNotification(id, n.title ?? 'Zelvo alarm', n.body ?? '', data),
    exactTrigger(Date.now() + SNOOZE_MINUTES * 60_000),
  );
}

/** Stop and Snooze pressed on the notification itself (works with Zelvo closed). */
export async function handleAlarmAction({ type, detail }: Event) {
  const n = detail.notification;
  if (type !== EventType.ACTION_PRESS || !n?.id || !isAlarm(n)) return;
  if (detail.pressAction?.id === 'stop') await stopAlarm(n.id);
  if (detail.pressAction?.id === 'snooze') await snoozeAlarm(n);
}

/** Alarms ringing right now, newest first. */
export async function ringingAlarms() {
  if (Platform.OS !== 'android') return [];
  const shown = await notifee.getDisplayedNotifications();
  return shown
    .filter((d) => isAlarm(d.notification))
    .sort((a, b) => Number(b.notification.data?.start ?? 0) - Number(a.notification.data?.start ?? 0));
}

// ===== Phone settings that alarms need =====

export type AlarmReadiness = {
  notifications: boolean;
  exact: boolean;
  fullScreen: boolean;
  soundOn: boolean;
  batteryOptimised: boolean;
  /** The phone maker has its own "app launch / auto-start" screen (Tecno, Infinix, itel, Xiaomi…). */
  powerManager: boolean;
};

export async function checkReadiness(): Promise<AlarmReadiness> {
  const settings = await notifee.getNotificationSettings();
  const [blocked, battery, power] = await Promise.all([
    notifee.isChannelBlocked(ALARM_CHANNEL).catch(() => false),
    notifee.isBatteryOptimizationEnabled().catch(() => false),
    notifee.getPowerManagerInfo().catch(() => ({ activity: null })),
  ]);
  return {
    notifications: settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
    exact: settings.android.alarm !== AndroidNotificationSetting.DISABLED,
    fullScreen: settings.android.fullScreenIntent !== AndroidNotificationSetting.DISABLED && AlarmWindow.canUseFullScreen(),
    soundOn: !blocked,
    batteryOptimised: battery,
    powerManager: !!power.activity,
  };
}
