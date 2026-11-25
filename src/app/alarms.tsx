import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import notifee, { AuthorizationStatus } from 'react-native-notify-kit';
import { AlarmWindow } from '../../modules/alarm-window';
import { colors, radius, space } from '../components/theme';
import { Banner, Button, Card, Chip, Group, ListRow, Screen, SectionTitle } from '../components/ui';
import {
  ALARM_CHANNEL,
  checkReadiness,
  getAlarmSettings,
  isoDate,
  LEAD_CHOICES,
  leadLabel,
  saveAlarmSettings,
  syncAlarms,
  testAlarm,
  type AlarmReadiness,
  type AlarmSettings,
  type PlannedAlarm,
} from '../lib/alarms';
import { friendlyError } from '../lib/errors';
import { useAlarmPlaces } from '../lib/useAlarms';

const dateText = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

function whenText(ms: number) {
  const d = new Date(ms);
  const t = new Date();
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isoDate(d) === isoDate(t)) return `Today, ${time}`;
  if (isoDate(d) === isoDate(tomorrow)) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

/** Lesson alarms: on/off, how many minutes before, phone settings, a test, and what's coming. */
export default function Alarms() {
  const { userId, places } = useAlarmPlaces();
  const [settings, setSettings] = useState<AlarmSettings | null>(null);
  const [ready, setReady] = useState<AlarmReadiness | null>(null);
  const [plan, setPlan] = useState<PlannedAlarm[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tested, setTested] = useState(false);

  const recheck = useCallback(() => {
    checkReadiness()
      .then(setReady)
      .catch(() => undefined);
  }, []);

  const sync = useCallback(() => {
    syncAlarms(userId, places)
      .then(setPlan)
      .catch((e) => setMessage(friendlyError(e)));
  }, [userId, places]);

  useEffect(() => {
    getAlarmSettings().then(setSettings);
  }, []);

  // Check again on return from the phone's Settings.
  useFocusEffect(
    useCallback(() => {
      recheck();
      sync();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') recheck();
      });
      return () => sub.remove();
    }, [recheck, sync]),
  );

  const change = async (next: AlarmSettings) => {
    setSettings(next);
    await saveAlarmSettings(next);
    sync();
  };

  const allow = async () => {
    const s = await notifee.requestPermission();
    if (s.authorizationStatus !== AuthorizationStatus.AUTHORIZED) await notifee.openNotificationSettings();
    recheck();
  };

  const pauseForHoliday = () => {
    const t = new Date();
    DateTimePickerAndroid.open({
      mode: 'date',
      value: new Date(t.getFullYear(), t.getMonth(), t.getDate() + 14),
      minimumDate: new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1),
      title: 'Alarms come back on',
      onChange: (e, d) => {
        if (e.type === 'set' && d && settings) change({ ...settings, resumeOn: isoDate(d) });
      },
    });
  };

  const runTest = async () => {
    try {
      if (ready && !ready.notifications) await allow();
      await testAlarm(10);
      setTested(true);
    } catch (e) {
      setMessage(friendlyError(e));
    }
  };

  if (Platform.OS !== 'android') {
    return (
      <Screen>
        <Banner tone="info" icon="information-circle" title="Lesson alarms work on Android phones." />
      </Screen>
    );
  }
  if (!settings) return <Screen>{null}</Screen>;

  const problems = ready
    ? [
        !ready.notifications && {
          key: 'notifications',
          icon: 'notifications-off-outline' as const,
          title: 'Allow Zelvo to ring',
          text: "Without this, alarms can't make a sound or show.",
          action: <Button small title="Allow" onPress={allow} />,
        },
        !ready.soundOn && {
          key: 'sound',
          icon: 'volume-mute-outline' as const,
          title: 'Lesson alarms are switched off in Settings',
          text: 'Turn on "Lesson alarms" for Zelvo.',
          action: <Button small title="Open settings" onPress={() => notifee.openNotificationSettings(ALARM_CHANNEL)} />,
        },
        !ready.exact && {
          key: 'exact',
          icon: 'time-outline' as const,
          title: 'Let Zelvo ring at the exact minute',
          text: 'Turn on "Alarms & reminders" for Zelvo.',
          action: <Button small title="Open settings" onPress={() => notifee.openAlarmPermissionSettings()} />,
        },
        !ready.fullScreen && {
          key: 'fullscreen',
          icon: 'phone-portrait-outline' as const,
          title: 'Let the alarm fill the screen',
          text: 'Turn on "Full screen notifications" for Zelvo, so the alarm shows even when your phone is locked.',
          action: <Button small title="Open settings" onPress={() => AlarmWindow.openFullScreenSettings()} />,
        },
      ].filter((x) => !!x)
    : [];

  const upcoming = (plan ?? []).slice(0, 6);
  const on = settings.enabled;

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card style={styles.hero}>
        <View style={[styles.heroIcon, !on && { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={on ? 'alarm' : 'alarm-outline'} size={28} color={on ? '#FFFFFF' : colors.muted} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heroTitle}>{on ? 'Lesson alarms are on' : 'Lesson alarms are off'}</Text>
          <Text style={styles.heroText}>
            {on
              ? `Rings ${settings.lead === 0 ? 'when each lesson starts' : `${settings.lead} minutes before each lesson`}, and before exams you invigilate.`
              : 'Turn on to get an alarm before each lesson you teach.'}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => change({ ...settings, enabled: v })}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Lesson alarms"
        />
      </Card>

      {on && settings.resumeOn ? (
        <Banner
          tone="info"
          icon="sunny-outline"
          title={`Paused for the holiday until ${dateText(settings.resumeOn)}`}
          text="Alarms come back on by themselves that day."
          action={<Button small variant="secondary" title="Turn back on now" onPress={() => change({ ...settings, resumeOn: null })} />}
        />
      ) : null}

      {on ? (
        <>
          <SectionTitle>When to ring</SectionTitle>
          <View style={styles.chips}>
            {LEAD_CHOICES.map((m) => (
              <Chip key={m} label={leadLabel(m)} selected={settings.lead === m} onPress={() => change({ ...settings, lead: m })} />
            ))}
          </View>

          {problems.length > 0 ? (
            <>
              <SectionTitle>Phone settings to fix</SectionTitle>
              <View style={{ gap: space.sm }}>
                {problems.map((p) => (
                  <Banner key={p.key} tone="warning" icon={p.icon} title={p.title} text={p.text} action={p.action} />
                ))}
              </View>
            </>
          ) : ready ? (
            <View style={styles.okRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.okText}>Your phone is set up for alarms.</Text>
            </View>
          ) : null}

          <SectionTitle>Check it works</SectionTitle>
          <Card style={{ gap: space.md }}>
            <Text style={styles.text}>
              {tested
                ? 'Lock your phone now. The test alarm rings in 10 seconds and should fill the screen.'
                : 'Ring a test alarm, then lock your phone to see how it looks.'}
            </Text>
            <Button icon="alarm-outline" variant="secondary" title="Ring a test alarm in 10 seconds" onPress={runTest} />
          </Card>

          <SectionTitle>If alarms don&apos;t ring</SectionTitle>
          <Group>
            {ready?.batteryOptimised ? (
              <ListRow
                icon="battery-half-outline"
                title="Don't let battery saver stop Zelvo"
                subtitle='Choose "Don’t optimise" or "Unrestricted" for Zelvo.'
                onPress={() => notifee.openBatteryOptimizationSettings()}
              />
            ) : null}
            {ready?.powerManager ? (
              <ListRow
                icon="rocket-outline"
                title="Allow Zelvo to auto-start"
                subtitle="Tecno, Infinix, itel, Xiaomi and some other phones close apps to save battery."
                onPress={() => notifee.openPowerManagerSettings()}
              />
            ) : null}
            <ListRow icon="volume-high-outline" title="Alarm sound and vibration" subtitle="Change how lesson alarms sound" onPress={() => notifee.openNotificationSettings(ALARM_CHANNEL)} />
          </Group>

          <SectionTitle>Holiday</SectionTitle>
          <Group>
            <ListRow
              icon="sunny-outline"
              title={settings.resumeOn ? 'Change the day alarms come back' : 'Pause alarms for a holiday'}
              subtitle="Choose the day school starts again"
              onPress={pauseForHoliday}
            />
          </Group>

          <SectionTitle>Next alarms</SectionTitle>
          {plan === null ? (
            <Text style={styles.text}>Checking your timetable…</Text>
          ) : upcoming.length === 0 ? (
            <Card>
              <Text style={styles.text}>
                {settings.resumeOn
                  ? 'No alarms until the holiday ends.'
                  : 'No lessons for you on the timetable yet. When the vice-principal adds your lessons, alarms are set here by themselves.'}
              </Text>
            </Card>
          ) : (
            <Group>
              {upcoming.map((a) => (
                <ListRow
                  key={a.id}
                  icon={a.kind === 'exam' ? 'document-text-outline' : 'book-outline'}
                  title={a.title}
                  subtitle={`${whenText(a.at)} · ${a.body}`}
                />
              ))}
            </Group>
          )}
          {plan && plan.length > upcoming.length ? (
            <Text style={[styles.text, { marginTop: space.sm }]}>
              And {plan.length - upcoming.length} more over the next four weeks. They ring even with no internet.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  heroText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  okText: { fontSize: 14, color: colors.success, fontWeight: '600' },
  text: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
