import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../../components/theme';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  Group,
  IconButton,
  ListRow,
  LoadingView,
  Screen,
  SectionTitle,
  confirm,
} from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { keyProgress } from '../../../lib/exams';
import { buildRows, shareResultsCsv, shareResultsPdf, type ResultExam } from '../../../lib/results';
import { discardScan, onScansChanged, pendingScans, syncScans, type PendingScan } from '../../../lib/scan/queue';
import { useCurrentSchool } from '../../../lib/school';
import { scoreScript } from '../../../lib/scoring';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

async function load(id: string) {
  const exam = must(
    await supabase
      .from('exams')
      .select('id, title, exam_date, question_count, option_count, answer_key, mark_per_question, record_out_of, class_id, classes(name), subjects(name)')
      .eq('id', id)
      .single(),
  );
  const [scripts, students] = await Promise.all([
    supabase.from('scripts').select('id, student_id, student_name, answers, pages_scanned').eq('exam_id', id).then(must),
    supabase.from('students').select('id, full_name').eq('class_id', exam.class_id).order('full_name').then(must),
  ]);
  return { exam, scripts, students };
}

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { school } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(id), id);
  const [pending, setPending] = useState<PendingScan[]>([]);
  const [busy, setBusy] = useState<'csv' | 'pdf' | 'sync' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refreshPending = () => pendingScans(id).then(setPending);
    refreshPending();
    return onScansChanged(refreshPending);
  }, [id]);

  // Send anything waiting, then show the latest results.
  useFocusEffect(
    useCallback(() => {
      syncScans()
        .then((r) => (r.sent > 0 ? reload() : undefined))
        .catch(() => undefined);
    }, [reload]),
  );

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { exam, scripts, students } = data!;
  const names = new Map(students.map((s) => [s.id, s.full_name]));
  const resultExam: ResultExam = {
    ...exam,
    mark_per_question: Number(exam.mark_per_question),
    record_out_of: exam.record_out_of === null ? null : Number(exam.record_out_of),
    className: exam.classes?.name ?? '',
    subjectName: exam.subjects?.name ?? '',
  };
  const rows = buildRows(resultExam, scripts, names);
  const scored = rows.filter((r) => r.score.outOf > 0);
  const percents = scored.map((r) => r.score.percent);
  const average = percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null;
  const toCheck = rows.reduce((n, r) => n + r.score.toCheck, 0);
  const { set, total } = keyProgress(exam.answer_key);
  const scannedIds = new Set(scripts.map((s) => s.student_id).filter(Boolean));
  const notScanned = students.filter((s) => !scannedIds.has(s.id));
  const waiting = pending.filter((p) => !p.error);
  const failed = pending.filter((p) => p.error);
  const outOf = resultExam.record_out_of;

  async function exportAs(kind: 'csv' | 'pdf') {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'csv') await shareResultsCsv(resultExam, rows);
      else await shareResultsPdf(resultExam, rows, school.name);
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendNow() {
    setBusy('sync');
    const r = await syncScans();
    setBusy(null);
    if (r.offline) setMessage('Still offline. Scans will be sent when you have internet.');
    else await reload();
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Results' }} />
      {message ? <Banner tone="warning" icon="alert-circle" title={message} /> : null}
      {set < total ? (
        <Banner
          tone="warning"
          icon="key-outline"
          title={`Answer key: ${total - set} ${total - set === 1 ? 'question' : 'questions'} not set`}
          text="Those questions aren't counted yet. Scores update as soon as you finish the key."
          action={<Button small title="Finish the key" onPress={() => router.push({ pathname: '/exams/[id]/key', params: { id } })} />}
        />
      ) : null}

      <Card style={{ gap: 4 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{exam.title}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {resultExam.subjectName} · {resultExam.className}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
          <Stat label="Scripts" value={String(rows.length)} />
          <Stat label="Average" value={average === null ? '–' : `${average}%`} />
          <Stat label="Highest" value={percents.length ? `${Math.max(...percents)}%` : '–'} />
          <Stat label="Lowest" value={percents.length ? `${Math.min(...percents)}%` : '–'} />
        </View>
      </Card>

      {toCheck > 0 ? (
        <Banner tone="info" icon="eye-outline" title={`${toCheck} ${toCheck === 1 ? 'answer' : 'answers'} to check`} text="Open a script marked “Check” to confirm what the student shaded." />
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Button
          icon="scan-outline"
          title="Scan more"
          onPress={() => router.push({ pathname: '/exams/[id]/scan', params: { id } })}
          style={{ flex: 1 }}
        />
      </View>

      {waiting.length > 0 || failed.length > 0 ? (
        <>
          <SectionTitle right={waiting.length ? <Button small variant="ghost" title="Send now" onPress={sendNow} loading={busy === 'sync'} /> : undefined}>
            Waiting to upload
          </SectionTitle>
          <Group>
            {waiting.map((p) => (
              <ListRow key={p.id} icon="cloud-upload-outline" title={p.studentName ?? 'Unnamed script'} subtitle={`Page ${p.page} · saved on this phone`} />
            ))}
            {failed.map((p) => (
              <ListRow
                key={p.id}
                icon="alert-circle-outline"
                title={p.studentName ?? 'Unnamed script'}
                subtitle={`Page ${p.page} · ${p.error}`}
                right={
                  <IconButton
                    icon="trash-outline"
                    label="Discard scan"
                    onPress={async () => {
                      if (await confirm('Discard this scan?', 'You can scan the sheet again.', 'Discard')) discardScan(p.id);
                    }}
                  />
                }
              />
            ))}
          </Group>
        </>
      ) : null}

      {rows.length === 0 && waiting.length === 0 ? (
        <EmptyState icon="scan-outline" title="No scripts yet" text="Scan the answer sheets after the exam. Results appear here." />
      ) : null}

      {rows.length > 0 ? (
        <>
          <SectionTitle>{`Scores${outOf ? ` (recorded out of ${outOf})` : ''}`}</SectionTitle>
          <Group>
            {scripts
              .map((s) => ({ s, name: (s.student_id ? names.get(s.student_id) : null) ?? s.student_name ?? 'Unnamed script' }))
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
              .map(({ s, name }) => {
                const sc = scoreScript(s.answers, exam.answer_key, Number(exam.mark_per_question), outOf);
                const badges = [];
                if (sc.toCheck) badges.push(<Badge key="c" label={`Check ${sc.toCheck}`} tone="warning" />);
                if (sc.missing) badges.push(<Badge key="m" label="Page missing" tone="warning" />);
                return (
                  <ListRow
                    key={s.id}
                    title={name}
                    subtitle={`${sc.score} / ${sc.outOf} · ${sc.percent}%${sc.recorded !== null ? ` · ${sc.recorded} / ${outOf}` : ''}`}
                    right={badges.length ? <View style={{ flexDirection: 'row', gap: 4 }}>{badges}</View> : undefined}
                    onPress={() => router.push({ pathname: '/exams/[id]/script/[scriptId]', params: { id, scriptId: s.id } })}
                  />
                );
              })}
          </Group>

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Button variant="secondary" icon="grid-outline" title="Spreadsheet" onPress={() => exportAs('csv')} loading={busy === 'csv'} style={{ flex: 1 }} />
            <Button variant="secondary" icon="document-outline" title="PDF" onPress={() => exportAs('pdf')} loading={busy === 'pdf'} style={{ flex: 1 }} />
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: space.xs }}>
            The spreadsheet (CSV) opens in Excel or Google Sheets and includes every student&apos;s answers.
          </Text>
        </>
      ) : null}

      {notScanned.length > 0 && rows.length > 0 ? (
        <>
          <SectionTitle>{`Not scanned yet (${notScanned.length})`}</SectionTitle>
          <Text style={{ fontSize: 14, color: colors.muted }}>{notScanned.map((s) => s.full_name).join(', ')}</Text>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}
