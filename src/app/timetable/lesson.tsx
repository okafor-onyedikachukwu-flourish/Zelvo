import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, Chip, ErrorView, Field, Input, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { dayName, loadTimetable, timeRange, type TimetableData } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

/** Add or change the lesson a class has in one period on one day. */
export default function LessonEditor() {
  const { classId, day, periodId } = useLocalSearchParams<{ classId: string; day: string; periodId: string }>();
  const { schoolId } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => loadTimetable(schoolId), schoolId);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <LessonForm data={data!} classId={classId} day={Number(day)} periodId={periodId} />;
}

function LessonForm({ data, classId, day, periodId }: { data: TimetableData; classId: string; day: number; periodId: string }) {
  const { schoolId } = useCurrentSchool();
  const existing = data.lessons.find((l) => l.class_id === classId && l.day === day && l.period_id === periodId);
  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? '');
  const [teacherId, setTeacherId] = useState<string | null>(existing?.teacher_id ?? null);
  const [room, setRoom] = useState(existing?.room ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const period = data.periods.find((p) => p.id === periodId);
  const cls = data.classes.find((c) => c.id === classId);
  const className = (id: string) => data.classes.find((c) => c.id === id)?.name ?? 'another class';

  // Who already teaches at this time (in another class)?
  const busyWith = new Map<string, string>();
  for (const l of data.lessons) {
    if (l.day === day && l.period_id === periodId && l.teacher_id && l.id !== existing?.id) busyWith.set(l.teacher_id, className(l.class_id));
  }
  const teachesIt = data.teachers.filter((t) => subjectId && t.subjectIds.includes(subjectId));
  const others = data.teachers.filter((t) => !teachesIt.includes(t));

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
      const fields = { subject_id: subjectId, teacher_id: teacherId, room: room.trim() || null };
      if (existing) must(await supabase.from('lessons').update(fields).eq('id', existing.id).select('id').single());
      else
        must(
          await supabase
            .from('lessons')
            .insert({ ...fields, school_id: schoolId, class_id: classId, day, period_id: periodId })
            .select('id')
            .single(),
        );
    });

  const remove = () =>
    run('remove', async () => {
      if (existing) must(await supabase.from('lessons').delete().eq('id', existing.id));
    });

  const teacherChip = (t: TimetableData['teachers'][number]) => {
    const other = busyWith.get(t.id);
    return (
      <Chip
        key={t.id}
        label={other ? `${t.name} (busy: ${other})` : t.name}
        selected={teacherId === t.id}
        disabled={!!other}
        onPress={() => setTeacherId(t.id)}
      />
    );
  };

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      <Card style={{ gap: 2, marginBottom: space.lg }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{cls?.name}</Text>
        <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>
          {dayName(day)} · {period?.label}
        </Text>
        {period ? <Text style={{ fontSize: 14, color: colors.muted }}>{timeRange(period)}</Text> : null}
      </Card>

      <SectionTitle>Subject</SectionTitle>
      {data.subjects.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.warning }}>Add departments first (School → Departments).</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {data.subjects.map((s) => (
            <Chip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
          ))}
        </View>
      )}

      <SectionTitle>Teacher</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="No teacher yet" selected={teacherId === null} onPress={() => setTeacherId(null)} />
        {teachesIt.map(teacherChip)}
      </View>
      {others.length > 0 ? (
        <>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.md, marginBottom: space.sm }}>
            {subjectId ? 'Other staff' : 'Choose a subject to see who teaches it first.'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{others.map(teacherChip)}</View>
        </>
      ) : null}

      <View style={{ marginTop: space.xl }}>
        <Field label="Room (optional)">
          <Input value={room} onChangeText={setRoom} placeholder="e.g. Lab 2" />
        </Field>
      </View>

      <Button title={existing ? 'Save changes' : 'Add lesson'} onPress={save} loading={busy === 'save'} />
      {existing ? (
        <Button variant="danger" icon="trash-outline" title="Remove this lesson" onPress={remove} loading={busy === 'remove'} style={{ marginTop: space.md }} />
      ) : null}
    </Screen>
  );
}
