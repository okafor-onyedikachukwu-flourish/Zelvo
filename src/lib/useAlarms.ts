// Keeps lesson alarms up to date, and opens the alarm screen when one rings.
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import notifee, { EventType, type Notification } from 'react-native-notify-kit';
import { AlarmWindow } from '../../modules/alarm-window';
import { clearStaleAlarms, handleAlarmAction, isAlarm, ringingAlarms, syncAlarms, type StaffPlace } from './alarms';
import { useAuth } from './auth';
import { useSchool } from './school';

/** The schools this account works at, for alarms. */
export function useAlarmPlaces(): { userId: string | null; places: StaffPlace[] } {
  const { session } = useAuth();
  const { memberships } = useSchool();
  const key = memberships.map((m) => `${m.staffId}:${m.school.id}:${m.school.suspended_at ? 1 : 0}`).join(',');
  const places = useMemo(
    () => memberships.map((m) => ({ staffId: m.staffId, schoolId: m.school.id, suspended: !!m.school.suspended_at })),
    // `key` changes exactly when the list does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return { userId: session?.user.id ?? null, places };
}

let alarmScreenVisible = false;
export const setAlarmScreenVisible = (v: boolean) => {
  alarmScreenVisible = v;
};

// Each alarm opens the alarm screen once, and never more than a few times a minute.
const shownFor = new Set<string>();
const recentOpens: number[] = [];

/** `key`: the alarm and when it was shown, so a test alarm rung twice opens the screen twice. */
function openAlarmScreen(n: Notification, key: string) {
  if (alarmScreenVisible || !n.id || shownFor.has(key)) return;
  const now = Date.now();
  while (recentOpens.length && now - recentOpens[0] > 60_000) recentOpens.shift();
  if (recentOpens.length >= 3) return;
  recentOpens.push(now);
  shownFor.add(key);
  alarmScreenVisible = true;
  const data = n.data ?? {};
  router.push({
    pathname: '/alarm',
    params: {
      id: n.id,
      title: n.title ?? '',
      body: n.body ?? '',
      kind: String(data.kind ?? ''),
      start: String(data.start ?? ''),
    },
  });
}

/** `ready`: accounts have loaded and the screens are on show. */
export function useAlarms(ready: boolean) {
  const { userId, places } = useAlarmPlaces();

  // Set (or clear) the alarms when the app opens, comes back to the front, or the account changes.
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    const sync = () => syncAlarms(userId, places).catch(() => undefined);
    sync();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [ready, userId, places]);

  // Show the alarm screen only when an alarm opened Zelvo, or rang while Zelvo was open.
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    let cancelled = false;
    const showRinging = async (id?: string) => {
      try {
        const ringing = await ringingAlarms();
        const d = id ? ringing.find((r) => r.notification.id === id) : ringing[0];
        if (!cancelled && d) openAlarmScreen(d.notification, `${d.notification.id}:${d.date ?? ''}`);
      } catch {
        // No alarm screen: the notification itself still rings and has Stop and Snooze.
      }
    };
    const openedByAlarm = () => {
      if (AlarmWindow.takeAlarmLaunch()) showRinging();
    };
    clearStaleAlarms().catch(() => undefined);
    const first = setTimeout(openedByAlarm, 300);
    const unsubscribe = notifee.onForegroundEvent((event) => {
      const n = event.detail.notification;
      if (event.type === EventType.ACTION_PRESS) {
        handleAlarmAction(event).catch(() => undefined);
        return;
      }
      if ((event.type === EventType.DELIVERED || event.type === EventType.PRESS) && isAlarm(n)) showRinging(n?.id);
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') openedByAlarm();
    });
    return () => {
      cancelled = true;
      clearTimeout(first);
      unsubscribe();
      sub.remove();
    };
  }, [ready]);
}
