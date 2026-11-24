import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../../components/theme';
import { Card, Chip, ErrorView, LoadingView, Screen } from '../../../components/ui';
import { FREE, UNSET } from '../../../lib/exams';
import { describeAnswer, scoreScript } from '../../../lib/scoring';
import { formatDate } from '../../../lib/sheet/render';
import { useLoad } from '../../../lib/useLoad';
import { loadMyResults } from '../../../lib/studentResults';

export default function StudentResult() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const { data, loading, error, reload } = useLoad(loadMyResults, examId);
  const [onlyWrong, setOnlyWrong] = useState(false);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const r = (data ?? []).find((x) => x.exam_id === examId);
  if (!r) return <ErrorView message="This result isn't available any more." onRetry={reload} />;

  const outOf = r.record_out_of === null ? null : Number(r.record_out_of);
  const sc = scoreScript(r.answers, r.answer_key, Number(r.mark_per_question), outOf);
  const rows = Array.from({ length: r.question_count }, (_, i) => {
    const a = r.answers[i] ?? UNSET;
    const k = r.answer_key[i] ?? UNSET;
    const counted = k !== UNSET;
    const right = counted && (k === FREE || a.toUpperCase() === k);
    return { i, a, k, counted, right };
  });
  const shown = onlyWrong ? rows.filter((x) => x.counted && !x.right) : rows;

  return (
    <Screen>
      <Stack.Screen options={{ title: r.title }} />
      <Card style={{ gap: 4 }}>
        <Text style={{ fontSize: 15, color: colors.muted }}>{[r.subject, formatDate(r.exam_date)].filter(Boolean).join(' · ')}</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
          {sc.score} / {sc.outOf} · {sc.percent}%
        </Text>
        {sc.recorded !== null ? (
          <Text style={{ fontSize: 15, color: colors.text }}>
            Recorded: {sc.recorded} / {outOf}
          </Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.lg }}>
        <Chip label="All questions" selected={!onlyWrong} onPress={() => setOnlyWrong(false)} />
        <Chip label={`Wrong only (${rows.filter((x) => x.counted && !x.right).length})`} selected={onlyWrong} onPress={() => setOnlyWrong(true)} />
      </View>

      {shown.map(({ i, a, k, counted, right }) => (
        <View key={i} style={[styles.row, counted && !right && styles.rowWrong]}>
          <Text style={styles.num}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.answer}>Your answer: {describeAnswer(a)}</Text>
            {counted && !right && k !== FREE ? <Text style={styles.correct}>Correct answer: {k}</Text> : null}
            {k === FREE ? <Text style={styles.note}>Everyone got this mark</Text> : null}
          </View>
          <Text style={[styles.mark, { color: !counted ? colors.faint : right ? colors.success : colors.danger }]}>
            {!counted ? '–' : right ? '✓' : '✗'}
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowWrong: { borderColor: colors.dangerSoft, backgroundColor: '#FFF7F7' },
  num: { width: 34, fontSize: 16, fontWeight: '800', color: colors.text },
  answer: { fontSize: 15, color: colors.text },
  correct: { fontSize: 14, color: colors.success, fontWeight: '600', marginTop: 2 },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  mark: { fontSize: 22, fontWeight: '800' },
});
