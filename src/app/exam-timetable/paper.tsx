import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TimeField } from '../../components/TimeField';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, Chip, confirm, EmptyState, ErrorView, Field, Input, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { dateLabel, datesBetween, durationText, loadExamPeriod, rangeLabel, sittings, type ExamPeriodData } from '../../lib/examTimetable';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { hhmm, minutes } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

const LENGTHS = [60, 90, 120, 150, 180];

/** Add or change one paper: date, time, subject, which classes write it, invigilator and room. */
export default function PaperEditor() {
  const { period, ids, day } = useLocalSearchParams<{ period: string; ids?: string; day?: string }>();
  const { schoolId } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => loadExamPeriod(schoolId, period), `${schoolId}:${period}`);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data?.period) {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="This exam period was removed" text="Someone deleted it from the exam timetable." action={<Button title="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  return <PaperForm data={data} ids={ids ? ids.split(',').filter(Boolean) : []} day={day} />;
}

function PaperForm({ data, ids, day }: { data: ExamPeriodData; ids: string[]; day?: string }) {
  const { schoolId } = useCurrentSchool();
  const period = data.period!;
  const existing = useMemo(() => sittings(data.papers.filter((p) => ids.includes(p.id)))[0] ?? null, [data.papers, ids]);
  const dates = datesBetween(period.starts_on, period.ends_on);

  const [date, setDate] = useState(existing?.day ?? (day && dates.includes(day) ? day : dates[0]));
  const [start, setStart] = useState(existing?.starts_at.slice(0, 5) ?? '09:00');
  const [end, setEnd] = useState(existing?.ends_at.slice(0, 5) ?? '11:00');
  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? '');
  const [paper, setPaper] = useState(existing?.paper ?? '');
  const [classIds, setClassIds] = useState<string[]>(existing?.classIds ?? []);
  const [invigilator, setInvigilator] = useState<string | null>(existing?.invigilator_id ?? null);
  const [room, setRoom] = useState(existing?.room ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Who's already busy at this time (papers other than this one).
  const overlapping = data.papers.filter(
    (p) => !ids.includes(p.id) && p.day === date && minutes(p.starts_at) < minutes(end) && minutes(p.ends_at) > minutes(start),
  );
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name ?? 'another paper';
  const classBusy = new Map(overlapping.map((p) => [p.class_id, subjectName(p.subject_id)]));
  const sameRoom = (r: string | null) => (r ?? '').trim().toLowerCase() === room.trim().toLowerCase();
  const invigilatorBusy = new Map(
    overlapping.filter((p) => p.invigilator_id && !sameRoom(p.room)).map((p) => [p.invigilator_id!, p.room || subjectName(p.subject_id)]),
  );

  const toggleClass = (id: string) => setClassIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  const free = data.classes.filter((c) => !classBusy.has(c.id));
  const allFree = free.length > 0 && free.every((c) => classIds.includes(c.id));
  const length = minutes(end) - minutes(start);

  const setLength = (mins: number) => setEnd(hhmm(minutes(start) + mins));
  const changeStart = (t: string) => {
    // Keep the same length when the start moves.
    const len = length > 0 ? length : 120;
    setStart(t);
    setEnd(hhmm(Math.min(minutes(t) + len, 23 * 60 + 59)));
  };

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
      router.back();
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      if (!subjectId) throw new Error('Choose the subject.');
      if (classIds.length === 0) throw new Error('Choose the classes writing this paper.');
      if (length <= 0) throw new Error('The paper must end after it starts.');
      must(
        await supabase.rpc('save_exam_sitting', {
          p_school: schoolId,
          p_period: period.id,
          p_replace: ids.length ? ids : null,
          p_sitting: { day: date, starts_at: start, ends_at: end, subject_id: subjectId, paper: paper.trim() || null, invigilator_id: invigilator, room: room.trim() || null },
          p_classes: classIds,
        }),
      );
    });

  const remove = async () => {
    const n = existing?.classIds.length ?? 0;
    const ok = await confirm('Remove this paper?', `${subjectName(existing?.subject_id ?? '')} will be removed for ${n} ${n === 1 ? 'class' : 'classes'}.`, 'Remove');
    if (!ok) return;
    run('remove', async () => {
      must(await supabase.from('exam_papers').delete().in('id', ids));
    });
  };

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      <Card style={{ gap: 2, marginBottom: space.lg }}>
        <Text style={styles.title}>{period.name}</Text>
        <Text style={styles.muted}>{rangeLabel(period.starts_on, period.ends_on)}</Text>
      </Card>

      <SectionTitle>Date</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {dates.map((d) => (
          <Chip key={d} label={dateLabel(d)} selected={d === date} onPress={() => setDate(d)} />
        ))}
      </ScrollView>

      <SectionTitle>Time</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Starts">
            <TimeField label="Starts" value={start} onChange={changeStart} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Ends">
            <TimeField label="Ends" value={end} onChange={setEnd} />
          </Field>
        </View>
      </View>
      <View style={styles.chips}>
        {LENGTHS.map((m) => (
          <Chip key={m} label={durationText('00:00', hhmm(m))} selected={length === m} onPress={() => setLength(m)} />
        ))}
      </View>

      <SectionTitle>Subject</SectionTitle>
      {data.subjects.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.warning }}>Add departments first (School → Departments).</Text>
      ) : (
        <View style={styles.chips}>
          {data.subjects.map((s) => (
            <Chip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
          ))}
        </View>
      )}
      <View style={{ marginTop: space.md }}>
        <Field label="Paper (optional)" hint='e.g. "Paper 1", "Objectives", "Practical"'>
          <Input value={paper} onChangeText={setPaper} placeholder="Paper 1" maxLength={40} />
        </Field>
      </View>

      <SectionTitle
        right={
          free.length > 1 ? (
            <Button small variant="ghost" title={allFree ? 'Clear' : 'All classes'} onPress={() => setClassIds(allFree ? [] : free.map((c) => c.id))} />
          ) : undefined
        }
      >
        Classes writing it
      </SectionTitle>
      {data.classes.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.warning }}>Add classes first (School → Classes).</Text>
      ) : (
        <View style={styles.chips}>
          {data.classes.map((c) => {
            const other = classBusy.get(c.id);
            return (
              <Chip
                key={c.id}
                label={other ? `${c.name} (writing ${other})` : c.name}
                selected={classIds.includes(c.id)}
                disabled={!!other && !classIds.includes(c.id)}
                onPress={() => toggleClass(c.id)}
              />
            );
          })}
        </View>
      )}

      <View style={{ marginTop: space.xl }}>
        <Field label="Room or hall (optional)" hint="Classes in the same hall at the same time can share one invigilator.">
          <Input value={room} onChangeText={setRoom} placeholder="e.g. Main hall" maxLength={40} />
        </Field>
      </View>

      <SectionTitle>Invigilator</SectionTitle>
      <Text style={[styles.muted, { marginBottom: space.sm }]}>They get an alarm before the paper starts.</Text>
      <View style={styles.chips}>
        <Chip label="Not yet" selected={invigilator === null} onPress={() => setInvigilator(null)} />
        {data.staff.map((s) => {
          const where = invigilatorBusy.get(s.id);
          return (
            <Chip
              key={s.id}
              label={where ? `${s.name} (busy: ${where})` : s.name}
              selected={invigilator === s.id}
              disabled={!!where && invigilator !== s.id}
              onPress={() => setInvigilator(s.id)}
            />
          );
        })}
      </View>

      <Button
        title={existing ? 'Save changes' : classIds.length > 1 ? `Add for ${classIds.length} classes` : 'Add paper'}
        onPress={save}
        loading={busy === 'save'}
        style={{ marginTop: space.xl }}
      />
      {existing ? (
        <Button variant="danger" icon="trash-outline" title="Remove this paper" onPress={remove} loading={busy === 'remove'} style={{ marginTop: space.md }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
});
