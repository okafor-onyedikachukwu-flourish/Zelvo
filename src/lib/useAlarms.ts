// Keeps lesson alarms up to date, and opens the alarm screen when one rings.
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import notifee, { EventType } from 'react-native-notify-kit';
import { handleAlarmAction, isAlarm, ringingAlarms, syncAlarms, type StaffPlace } from './alarms';
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

  // Show the alarm screen when an alarm is ringing.
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    let cancelled = false;
    const open = async () => {
      if (alarmScreenVisible) return;
      try {
        const ringing = await ringingAlarms();
        if (!cancelled && ringing.length > 0 && !alarmScreenVisible) {
          alarmScreenVisible = true;
          router.push('/alarm');
        }
      } catch {
        // No alarm screen: the notification itself still rings and has Stop and Snooze.
      }
    };
    const first = setTimeout(open, 300);
    const unsubscribe = notifee.onForegroundEvent((event) => {
      if (event.type === EventType.ACTION_PRESS) {
        handleAlarmAction(event).catch(() => undefined);
        return;
      }
      if ((event.type === EventType.DELIVERED || event.type === EventType.PRESS) && isAlarm(event.detail.notification)) open();
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') open();
    });
    return () => {
      cancelled = true;
      clearTimeout(first);
      unsubscribe();
      sub.remove();
    };
  }, [ready]);
}
