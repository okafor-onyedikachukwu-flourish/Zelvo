import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TimeField } from '../../components/TimeField';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, Chip, ErrorView, Field, Input, LoadingView, Screen, SectionTitle, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { DAYS, generatePeriods, hhmm, loadTimetable, minutes, timeRange, type TimetableData } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

type Row = { label: string; starts_at: string; ends_at: string; is_break: boolean };

export default function BellTimes() {
  const { schoolId } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => loadTimetable(schoolId), schoolId);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <BellForm key={JSON.stringify([data!.days, data!.periods])} data={data!} />;
}

function BellForm({ data }: { data: TimetableData }) {
  const { schoolId } = useCurrentSchool();
  const [days, setDays] = useState<number[]>(data.days);
  const [rows, setRows] = useState<Row[]>(
    data.periods.map((p) => ({ label: p.label, starts_at: p.starts_at.slice(0, 5), ends_at: p.ends_at.slice(0, 5), is_break: p.is_break })),
  );
  const [quick, setQuick] = useState({ start: '08:00', length: '40', count: '8', b1After: '3', b1Min: '20', b2After: '6', b2Min: '30' });
  const [showQuick, setShowQuick] = useState(data.periods.length === 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const num = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function fill() {
    const length = num(quick.length);
    const count = num(quick.count);
    if (length < 10 || length > 180) return setMessage('A lesson should be between 10 and 180 minutes.');
    if (count < 1 || count > 20) return setMessage('Choose between 1 and 20 lessons a day.');
    setMessage(null);
    setRows(
      generatePeriods({
        start: quick.start,
        lessonMinutes: length,
        lessons: count,
        breaks: [
          { after: num(quick.b1After), minutes: num(quick.b1Min), label: 'Break' },
          { after: num(quick.b2After), minutes: num(quick.b2Min), label: 'Lunch' },
        ],
      }),
    );
    setShowQuick(false);
  }

  function addRow() {
    const last = rows[rows.length - 1];
    const start = last ? minutes(last.ends_at) : 8 * 60;
    const lessons = rows.filter((r) => !r.is_break);
    const length = lessons.length ? minutes(lessons[lessons.length - 1].ends_at) - minutes(lessons[lessons.length - 1].starts_at) : 40;
    setRows([...rows, { label: `Period ${lessons.length + 1}`, starts_at: hhmm(start), ends_at: hhmm(start + length), is_break: false }]);
  }

  async function save() {
    if (days.length === 0) return setMessage('Choose at least one school day.');
    if (rows.length === 0) return setMessage('Add at least one period.');
    // Lessons in periods that go away (or turn into breaks), and on days that close, are removed.
    const sorted = [...rows].sort((a, b) => minutes(a.starts_at) - minutes(b.starts_at));
    const lost = data.lessons.filter((l) => {
      const p = data.periods.find((x) => x.id === l.period_id);
      if (!p) return false;
      const after = sorted[p.position - 1];
      return !after || after.is_break || !days.includes(l.day);
    }).length;
    if (lost > 0 && !(await confirm('Remove some lessons?', `${lost} ${lost === 1 ? 'lesson is' : 'lessons are'} in periods or days you removed. They will be deleted.`, 'Save anyway'))) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      must(await supabase.rpc('set_bell_times', { p_school: schoolId, p_periods: sorted }));
      if (JSON.stringify(days) !== JSON.stringify(data.days)) {
        must(await supabase.from('schools').update({ school_days: days }).eq('id', schoolId).select('id').single());
      }
      router.back();
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <SectionTitle>School days</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {DAYS.map((d) => (
          <Chip
            key={d.n}
            label={d.short}
            selected={days.includes(d.n)}
            onPress={() => setDays((ds) => (ds.includes(d.n) ? ds.filter((x) => x !== d.n) : [...ds, d.n].sort((a, b) => a - b)))}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle>Bell times</SectionTitle>
        <Button small variant="ghost" icon="flash-outline" title="Quick fill" onPress={() => setShowQuick((s) => !s)} style={{ marginTop: space.lg }} />
      </View>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.md }}>The same times are used every school day.</Text>

      {showQuick ? (
        <Card style={{ marginBottom: space.lg }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: space.md }}>Quick fill</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label="First lesson starts">
                <TimeField value={quick.start} onChange={(start) => setQuick({ ...quick, start })} label="First lesson starts" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Each lesson (min)">
                <Input value={quick.length} onChangeText={(length) => setQuick({ ...quick, length })} keyboardType="number-pad" />
              </Field>
            </View>
          </View>
          <Field label="Lessons a day">
            <Input value={quick.count} onChangeText={(count) => setQuick({ ...quick, count })} keyboardType="number-pad" />
          </Field>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Break after lesson">
                <Input value={quick.b1After} onChangeText={(b1After) => setQuick({ ...quick, b1After })} keyboardType="number-pad" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Break (min)">
                <Input value={quick.b1Min} onChangeText={(b1Min) => setQuick({ ...quick, b1Min })} keyboardType="number-pad" />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Lunch after lesson">
                <Input value={quick.b2After} onChangeText={(b2After) => setQuick({ ...quick, b2After })} keyboardType="number-pad" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Lunch (min)" hint="0 for none">
                <Input value={quick.b2Min} onChangeText={(b2Min) => setQuick({ ...quick, b2Min })} keyboardType="number-pad" />
              </Field>
            </View>
          </View>
          <Button icon="flash-outline" title="Fill in the bell times" onPress={fill} />
        </Card>
      ) : null}

      {rows.map((r, i) => (
        <Card key={i} style={{ marginBottom: space.sm, gap: space.sm, backgroundColor: r.is_break ? colors.bg : colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Input
              value={r.label}
              onChangeText={(label) => update(i, { label })}
              style={{ flex: 1, paddingVertical: 10, fontWeight: '700' }}
              accessibilityLabel="Name of this period"
            />
            <Chip label={r.is_break ? 'Break' : 'Lesson'} selected={r.is_break} onPress={() => update(i, { is_break: !r.is_break })} />
            <Pressable
              onPress={() => setRows(rows.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${r.label}`}
              hitSlop={8}
              style={{ padding: space.xs }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TimeField value={r.starts_at} onChange={(starts_at) => update(i, { starts_at })} label={`${r.label} starts`} />
            </View>
            <Text style={{ color: colors.muted }}>to</Text>
            <View style={{ flex: 1 }}>
              <TimeField value={r.ends_at} onChange={(ends_at) => update(i, { ends_at })} label={`${r.label} ends`} />
            </View>
          </View>
        </Card>
      ))}
      <Button variant="secondary" icon="add" title="Add a period" onPress={addRow} style={{ marginTop: space.sm }} />

      {rows.length > 0 ? (
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.md }}>
          School day: {timeRange({ starts_at: [...rows].sort((a, b) => minutes(a.starts_at) - minutes(b.starts_at))[0].starts_at, ends_at: [...rows].sort((a, b) => minutes(b.ends_at) - minutes(a.ends_at))[0].ends_at })}
        </Text>
      ) : null}

      <Button title="Save bell times" onPress={save} loading={busy} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
