import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Notification } from 'react-native-notify-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlarmWindow } from '../../modules/alarm-window';
import { useLightStatusBar } from '../components/Photo';
import { colors, radius, space } from '../components/theme';
import { ringingAlarms, SNOOZE_MINUTES, snoozeAlarm, stopAlarm } from '../lib/alarms';
import { setAlarmScreenVisible } from '../lib/useAlarms';

/** The full-screen alarm: shows over the lock screen while a lesson alarm rings. */
export default function AlarmScreen() {
  useLightStatusBar();
  const insets = useSafeAreaInsets();
  // The alarm's details come with the screen, so it shows straight away.
  const params = useLocalSearchParams<{ id?: string; title?: string; body?: string; kind?: string; start?: string }>();
  const [alarm, setAlarm] = useState<Notification | null>(
    params.id
      ? { id: params.id, title: params.title || undefined, body: params.body || undefined, data: { kind: params.kind ?? '', start: params.start ?? '' } }
      : null,
  );
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const leaving = useRef(false);
  const [bell] = useState(() => new Animated.Value(0));

  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    await AlarmWindow.leave().catch(() => undefined);
    setAlarmScreenVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // Close when the alarm stops ringing (stopped from the notification, or it went quiet).
  useEffect(() => {
    setAlarmScreenVisible(true);
    const check = async () => {
      try {
        const ringing = await ringingAlarms();
        const mine = params.id ? ringing.find((r) => r.notification.id === params.id) : ringing[0];
        if (!mine) leave();
        else setAlarm(mine.notification);
      } catch {
        leave();
      }
    };
    check();
    const poll = setInterval(check, 2000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      back.remove();
      setAlarmScreenVisible(false);
    };
    // Runs once; `leave` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bell, { toValue: 1, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 240, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bell]);

  const act = async (what: 'stop' | 'snooze') => {
    if (!alarm?.id || busy) return;
    setBusy(true);
    try {
      if (what === 'stop') await stopAlarm(alarm.id);
      else await snoozeAlarm(alarm);
    } finally {
      leave();
    }
  };

  const start = Number(alarm?.data?.start ?? 0);
  const minsLeft = start ? Math.round((start - now.getTime()) / 60_000) : null;
  const kind = alarm?.data?.kind;
  const label = kind === 'exam' ? 'Invigilation' : kind === 'test' ? 'Test alarm' : 'Lesson';
  const when =
    minsLeft === null ? '' : minsLeft > 0 ? `starts in ${minsLeft} min` : minsLeft === 0 ? 'starts now' : `started ${-minsLeft} min ago`;
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const rotate = bell.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={styles.clock} accessibilityRole="header">
          {clock}
        </Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        <Animated.View style={[styles.bell, { transform: [{ rotate }] }]}>
          <Ionicons name={kind === 'exam' ? 'document-text' : 'notifications'} size={52} color={colors.hero} />
        </Animated.View>
        <Text style={styles.kind}>
          {label}
          {when ? ` ${when}` : ''}
        </Text>
        <Text style={styles.title} numberOfLines={3}>
          {alarm?.title ?? 'Zelvo alarm'}
        </Text>
        {alarm?.body ? <Text style={styles.body}>{alarm.body}</Text> : null}
      </View>

      <View style={{ gap: space.md, alignSelf: 'stretch' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop the alarm"
          onPress={() => act('stop')}
          disabled={busy}
          style={({ pressed }) => [styles.stop, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="stop-circle" size={26} color={colors.primary} />
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Snooze for ${SNOOZE_MINUTES} minutes`}
          onPress={() => act('snooze')}
          disabled={busy}
          style={({ pressed }) => [styles.snooze, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="alarm-outline" size={22} color="#FFFFFF" />
          <Text style={styles.snoozeText}>Snooze {SNOOZE_MINUTES} min</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.hero,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: colors.primary,
    opacity: 0.55,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -160,
    left: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.accent,
    opacity: 0.22,
  },
  clock: { fontSize: 64, fontWeight: '300', color: '#FFFFFF', letterSpacing: -1 },
  date: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  bell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  kind: { fontSize: 15, fontWeight: '700', color: '#FFD3B0', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  body: { fontSize: 17, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 24 },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 20,
  },
  stopText: { fontSize: 20, fontWeight: '800', color: colors.primary },
  snooze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  snoozeText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
