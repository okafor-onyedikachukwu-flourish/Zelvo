import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../../components/theme';
import { Banner, Button, Card, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle, confirm } from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { formatMarks, keyProgress, optionsLabel } from '../../../lib/exams';
import { deleteExamImages } from '../../../lib/scan/queue';
import { pageCount } from '../../../lib/sheet/layout';
import { formatDate } from '../../../lib/sheet/render';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

async function load(id: string) {
  return must(
    await supabase
      .from('exams')
      .select('id, school_id, title, exam_date, question_count, option_count, mark_per_question, record_out_of, answer_key, classes(name), subjects(name)')
      .eq('id', id)
      .single(),
  );
}

async function loadAll(id: string) {
  const [exam, scripts] = await Promise.all([
    load(id),
    supabase.from('scripts').select('id', { count: 'exact', head: true }).eq('exam_id', id),
  ]);
  if (scripts.error) throw scripts.error;
  return { ...exam, scriptCount: scripts.count ?? 0 };
}

export default function ExamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadAll(id), id);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const exam = data!;
  const { set, total } = keyProgress(exam.answer_key);
  const mark = Number(exam.mark_per_question);
  const pages = pageCount(exam.question_count, exam.option_count);

  async function remove() {
    const extra = exam.scriptCount > 0 ? ` and ${exam.scriptCount} scanned ${exam.scriptCount === 1 ? 'script' : 'scripts'}` : '';
    if (!(await confirm(`Delete "${exam.title}"?`, `Its answer key${extra} will be deleted too. This can't be undone.`))) return;
    try {
      await deleteExamImages(exam.school_id, exam.id).catch(() => undefined);
      must(await supabase.from('exams').delete().eq('id', exam.id));
      router.back();
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: exam.title }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{exam.title}</Text>
        <Text style={{ fontSize: 15, color: colors.text, marginTop: 4 }}>
          {[exam.subjects?.name, exam.classes?.name, formatDate(exam.exam_date)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
          {exam.question_count} questions · options {optionsLabel(exam.option_count)} · {formatMarks(mark)} each · total{' '}
          {formatMarks(exam.question_count * mark)}
          {exam.record_out_of ? ` · recorded out of ${Number(exam.record_out_of)}` : ''}
        </Text>
      </Card>

      <SectionTitle>Before the exam</SectionTitle>
      <Group>
        <ListRow
          icon="key-outline"
          title="Answer key"
          subtitle={set === total ? 'All answers set' : `${set} of ${total} answers set`}
          right={<Progress value={total ? set / total : 0} />}
          onPress={() => router.push({ pathname: '/exams/[id]/key', params: { id: exam.id } })}
        />
        <ListRow
          icon="print-outline"
          title="Answer sheets"
          subtitle={`Print or share as PDF · ${pages} ${pages === 1 ? 'page' : 'pages'} per student`}
          onPress={() => router.push({ pathname: '/exams/[id]/sheets', params: { id: exam.id } })}
        />
      </Group>

      <SectionTitle>After the exam</SectionTitle>
      <Group>
        <ListRow
          icon="scan-outline"
          title="Scan scripts"
          subtitle="Photograph the answer sheets; works without internet"
          onPress={() => router.push({ pathname: '/exams/[id]/scan', params: { id: exam.id } })}
        />
        <ListRow
          icon="stats-chart-outline"
          title="Results"
          subtitle={exam.scriptCount === 0 ? 'No scripts scanned yet' : `${exam.scriptCount} ${exam.scriptCount === 1 ? 'script' : 'scripts'} marked`}
          onPress={() => router.push({ pathname: '/exams/[id]/results', params: { id: exam.id } })}
        />
      </Group>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl }}>
        <Button
          variant="secondary"
          icon="create-outline"
          title="Edit details"
          onPress={() => router.push({ pathname: '/exams/[id]/edit', params: { id: exam.id } })}
          style={{ flex: 1 }}
        />
        <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <View style={{ width: 56, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.round(value * 100)}%`,
          height: 6,
          backgroundColor: value >= 1 ? colors.success : colors.primary,
        }}
      />
    </View>
  );
}
