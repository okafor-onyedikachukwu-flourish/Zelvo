import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { CalendarField } from '../../components/CalendarField';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, confirm, ErrorView, Field, Input, LoadingView, Screen } from '../../components/ui';
import { isoDate } from '../../lib/alarms';
import { friendlyError } from '../../lib/errors';
import { datesBetween, type ExamPeriod } from '../../lib/examTimetable';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

/** Add or change an exam period: its name, first and last day, and whether lessons stop. */
export default function ExamPeriodEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading, error, reload } = useLoad(
    async () =>
      id
        ? ((await supabase.from('exam_periods').select('id, name, starts_on, ends_on, lessons_stop').eq('id', id).maybeSingle().then(must)) as ExamPeriod | null)
        : null,
    id ?? 'new',
  );
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <PeriodForm existing={data} />;
}

function PeriodForm({ existing }: { existing: ExamPeriod | null }) {
  const { schoolId } = useCurrentSchool();
  const t = new Date();
  const [name, setName] = useState(existing?.name ?? '');
  const [from, setFrom] = useState(existing?.starts_on ?? isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 7)));
  const [to, setTo] = useState(existing?.ends_on ?? isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 18)));
  const [lessonsStop, setLessonsStop] = useState(existing?.lessons_stop ?? true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const days = to >= from ? datesBetween(from, to).length : 0;

  const changeFrom = (d: string) => {
    setFrom(d);
    if (to < d) setTo(d);
  };

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      if (name.trim().length < 2) throw new Error('Give the exams a name, like "First term exams".');
      if (to < from) throw new Error('The last day must be on or after the first day.');
      if (days > 63) throw new Error('An exam period can be at most 9 weeks long.');
      const fields = { name: name.trim(), starts_on: from, ends_on: to, lessons_stop: lessonsStop };
      if (existing) {
        must(await supabase.from('exam_periods').update(fields).eq('id', existing.id).select('id').single());
        router.back();
      } else {
        const made = must(await supabase.from('exam_periods').insert({ ...fields, school_id: schoolId }).select('id').single());
        router.replace({ pathname: '/exam-timetable/[id]', params: { id: made.id } });
      }
    });

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm('Delete these exams?', `${existing.name} and all its papers will be removed from the exam timetable.`);
    if (!ok) return;
    run('remove', async () => {
      must(await supabase.from('exam_periods').delete().eq('id', existing.id));
      router.dismissTo('/exam-timetable');
    });
  };

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      <Field label="Name">
        <Input value={name} onChangeText={setName} placeholder="e.g. First term exams" maxLength={60} autoFocus={!existing} />
      </Field>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="First day">
            <CalendarField label="First day" value={from} onChange={changeFrom} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last day">
            <CalendarField label="Last day" value={to} onChange={setTo} min={from} />
          </Field>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: -space.sm, marginBottom: space.lg }}>
        {days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Choose a last day after the first day.'}
      </Text>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Normal lessons stop</Text>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
            {lessonsStop
              ? 'Lesson alarms pause on these days. Turn off if only some classes write (e.g. SS3 mocks).'
              : 'Lessons carry on, so lesson alarms keep ringing alongside invigilation alarms.'}
          </Text>
        </View>
        <Switch value={lessonsStop} onValueChange={setLessonsStop} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
      </Card>

      <Button title={existing ? 'Save changes' : 'Create and add papers'} onPress={save} loading={busy === 'save'} />
      {existing ? (
        <Button variant="danger" icon="trash-outline" title="Delete these exams" onPress={remove} loading={busy === 'remove'} style={{ marginTop: space.md }} />
      ) : null}
    </Screen>
  );
}
