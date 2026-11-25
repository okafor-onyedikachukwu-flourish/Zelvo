import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../../components/BarChart';
import { colors, space } from '../../../components/theme';
import { Badge, Banner, Button, ErrorView, Field, Group, Input, ListRow, LoadingView, Screen, SectionTitle, confirm, type IconName } from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { loadOwnerSchool, sinceText } from '../../../lib/owner';
import { formatDate } from '../../../lib/sheet/render';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

/** One school, for the owner: setup progress, size, contacts, activity, and suspending it. */
export default function OwnerSchool() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadOwnerSchool(id), id);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const s = data!;
  const c = s.counts;

  const steps: { done: boolean; title: string; detail: string }[] = [
    { done: c.departments > 0, title: 'Departments added', detail: `${c.departments} departments` },
    { done: c.classes > 0, title: 'Classes added', detail: `${c.classes} classes` },
    { done: c.staff > 1, title: 'Staff joined', detail: `${c.staff} staff${c.staff_requests ? `, ${c.staff_requests} waiting` : ''}` },
    { done: c.periods > 0, title: 'Bell times set', detail: `${c.periods} lesson periods a day` },
    { done: c.lessons > 0, title: 'Timetable filled in', detail: `${c.lessons} lessons a week` },
    { done: c.exams > 0, title: 'First exam created', detail: `${c.exams} exams` },
    { done: c.scripts > 0, title: 'Scripts marked', detail: `${c.scripts} scripts` },
  ];
  const done = steps.filter((x) => x.done).length;

  async function setSuspended(suspend: boolean) {
    const ok = suspend
      ? await confirm(
          `Suspend ${s.name}?`,
          'Its staff and students will see that the school is paused and can’t open anything until you lift it. Nothing is deleted.',
          'Suspend',
        )
      : await confirm(`Lift the suspension?`, `${s.name} will work again straight away.`, 'Lift it');
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      must(await supabase.rpc('set_school_suspended', { p_school: s.id, p_suspend: suspend, p_reason: reason.trim() || null }));
      setReason('');
      await reload();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: s.name }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      {s.suspended_at ? (
        <Banner
          tone="warning"
          icon="pause-circle-outline"
          title={`Suspended since ${formatDate(s.suspended_at.slice(0, 10))}`}
          text={s.suspended_reason ? `Reason: ${s.suspended_reason}` : undefined}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{s.name}</Text>
        <Text style={styles.text}>{[s.country, `on Zelvo since ${formatDate(s.created_at.slice(0, 10))}`].filter(Boolean).join(' · ')}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
          <Badge label={sinceText(s.last_active)} tone={s.last_active ? 'success' : 'neutral'} />
          <Badge label={`${s.active_week} active this week`} tone="primary" />
        </View>
      </View>

      <SectionTitle>Setup</SectionTitle>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {done === steps.length ? 'Fully set up. Great work!' : `${done} of ${steps.length} done`}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.success }}>{Math.round((done / steps.length) * 100)}%</Text>
        </View>
        <ProgressBar progress={done / steps.length} color={colors.success} />
        <View style={{ marginTop: space.md, gap: 10 }}>
          {steps.map((x) => (
            <View key={x.title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name={x.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={x.done ? colors.success : colors.faint} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{x.title}</Text>
                <Text style={styles.text}>{x.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <SectionTitle>People</SectionTitle>
      <View style={styles.grid}>
        <Stat icon="id-card-outline" value={c.staff} label="Staff" />
        <Stat icon="school-outline" value={c.student_accounts} label="Students on Zelvo" />
        <Stat icon="list-outline" value={c.students} label="On class lists" />
        <Stat icon="time-outline" value={c.pending_students} label="Students waiting" />
      </View>

      <SectionTitle>Contacts</SectionTitle>
      <Group>
        {s.heads.length === 0 ? (
          <ListRow icon="person-outline" title="No head of school yet" />
        ) : (
          s.heads.map((h) => (
            <ListRow
              key={h.email}
              icon="mail-outline"
              title={h.name}
              subtitle={`${h.title === 'principal' ? 'Principal' : h.title === 'vp_academic' ? 'Vice-principal academic' : 'Head of school'} · ${h.email}`}
              onPress={() => Linking.openURL(`mailto:${h.email}?subject=${encodeURIComponent(`Zelvo: ${s.name}`)}`)}
            />
          ))
        )}
      </Group>

      <SectionTitle>Suspend</SectionTitle>
      {s.suspended_at ? (
        <Button icon="play-circle-outline" title="Lift the suspension" onPress={() => setSuspended(false)} loading={busy} />
      ) : (
        <>
          <Text style={[styles.text, { marginBottom: space.md }]}>
            For a fake or misused school. Its people see a &quot;paused&quot; notice until you lift it. Nothing is deleted.
          </Text>
          <Field label="Reason (they will see it)">
            <Input value={reason} onChangeText={setReason} placeholder="e.g. Not a real school" />
          </Field>
          <Button variant="danger" icon="pause-circle-outline" title="Suspend this school" onPress={() => setSuspended(true)} loading={busy} />
        </>
      )}
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={[styles.card, { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14 }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{value.toLocaleString()}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  text: { fontSize: 13, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
