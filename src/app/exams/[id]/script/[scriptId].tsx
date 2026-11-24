import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { QuestionCrop } from '../../../../components/QuestionCrop';
import { StudentPicker } from '../../../../components/StudentPicker';
import { colors, radius, space } from '../../../../components/theme';
import { Badge, Banner, Button, Card, ErrorView, LoadingView, Screen, SectionTitle, confirm } from '../../../../components/ui';
import { friendlyError } from '../../../../lib/errors';
import { FREE, UNSET, lettersFor } from '../../../../lib/exams';
import { deleteScriptImages, pageImageUrl } from '../../../../lib/scan/queue';
import { describeAnswer, scoreScript } from '../../../../lib/scoring';
import { gridShape } from '../../../../lib/sheet/layout';
import { must, supabase } from '../../../../lib/supabase';
import { useLoad } from '../../../../lib/useLoad';

async function load(examId: string, scriptId: string) {
  const [script, exam] = await Promise.all([
    supabase.from('scripts').select('id, student_id, student_name, answers, pages_scanned').eq('id', scriptId).single().then(must),
    supabase
      .from('exams')
      .select('id, school_id, question_count, option_count, answer_key, mark_per_question, record_out_of, class_id')
      .eq('id', examId)
      .single()
      .then(must),
  ]);
  const [students, taken] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('class_id', exam.class_id).order('full_name').then(must),
    supabase.from('scripts').select('student_id').eq('exam_id', examId).then(must),
  ]);
  const images: Record<number, string> = {};
  await Promise.all(
    script.pages_scanned.map(async (p) => {
      const url = await pageImageUrl(exam.school_id, exam.id, script.id, p);
      if (url) images[p] = url;
    }),
  );
  return { script, exam, students, taken: new Set(taken.map((t) => t.student_id).filter((v): v is string => !!v)), images };
}

export default function ScriptScreen() {
  const { id, scriptId } = useLocalSearchParams<{ id: string; scriptId: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id, scriptId), `${id}:${scriptId}`);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <ScriptReview key={data!.script.id} data={data!} reload={reload} />;
}

type Data = Awaited<ReturnType<typeof load>>;

function ScriptReview({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const { script, exam, students, taken, images } = data;
  const { width } = useWindowDimensions();
  const [answers, setAnswers] = useState(script.answers);
  const [editing, setEditing] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Show every answer straight away when there's nothing to check.
  const [showAll, setShowAll] = useState(() => ![...script.answers].some((a) => a === '#' || (a >= 'a' && a <= 'f')));

  const letters = lettersFor(exam.option_count);
  const perPage = gridShape(exam.option_count).perPage;
  const outOf = exam.record_out_of === null ? null : Number(exam.record_out_of);
  const sc = scoreScript(answers, exam.answer_key, Number(exam.mark_per_question), outOf);
  const name = (script.student_id ? students.find((s) => s.id === script.student_id)?.full_name : null) ?? script.student_name ?? 'Unnamed script';
  const flagged = [...answers].map((a, i) => ({ a, i })).filter(({ a }) => a === '#' || (a >= 'a' && a <= 'f'));

  async function setAnswer(i: number, value: string) {
    const next = answers.slice(0, i) + value + answers.slice(i + 1);
    const before = answers;
    setAnswers(next);
    setEditing(null);
    try {
      must(await supabase.from('scripts').update({ answers: next }).eq('id', script.id).select('id').single());
    } catch (e) {
      setAnswers(before);
      setMessage(friendlyError(e));
    }
  }

  async function changeStudent(studentId: string | null, studentName: string | null) {
    setPicking(false);
    if (studentId === null && studentName === null) return;
    try {
      must(
        await supabase
          .from('scripts')
          .update({ student_id: studentId, student_name: studentId ? null : studentName })
          .eq('id', script.id)
          .select('id')
          .single(),
      );
      await reload();
    } catch (e) {
      const err = e as { code?: string };
      setMessage(err.code === '23505' ? 'That student already has a script for this exam. Delete one of them first.' : friendlyError(e));
    }
  }

  async function remove() {
    if (!(await confirm(`Delete ${name}'s script?`, 'Their answers and page photos will be deleted. You can scan the sheet again.'))) return;
    try {
      must(await supabase.from('scripts').delete().eq('id', script.id));
      deleteScriptImages(exam.school_id, exam.id, script.id, script.pages_scanned).catch(() => undefined);
      router.back();
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  const cropWidth = Math.min(width - space.lg * 2 - 2, 420);

  const renderQuestion = (i: number, withCrop: boolean) => {
    const a = answers[i] ?? UNSET;
    const k = exam.answer_key[i] ?? UNSET;
    const page = Math.floor(i / perPage) + 1;
    const right = k !== UNSET && (k === FREE || a.toUpperCase() === k);
    const unsure = a === '#' || (a >= 'a' && a <= 'f');
    return (
      <View key={i} style={styles.question}>
        <Pressable onPress={() => setEditing(editing === i ? null : i)} style={styles.questionRow}>
          <Text style={styles.qNumber}>{i + 1}</Text>
          <Text style={[styles.qAnswer, unsure && { color: colors.warning }]}>{describeAnswer(a)}</Text>
          <Text style={styles.qKey}>{k === UNSET ? 'no key' : k === FREE ? 'free mark' : `key ${k}`}</Text>
          {k === UNSET ? null : <Badge label={right ? 'Right' : 'Wrong'} tone={right ? 'success' : 'neutral'} />}
        </Pressable>
        {withCrop && images[page] ? (
          <View style={{ marginTop: space.sm }}>
            <QuestionCrop uri={images[page]} indexOnPage={i % perPage} optionCount={exam.option_count} width={cropWidth} />
          </View>
        ) : null}
        {editing === i || (withCrop && unsure) ? (
          <View style={styles.choices}>
            {letters.map((l) => (
              <Pressable key={l} onPress={() => setAnswer(i, l)} style={[styles.choice, a === l && styles.choiceOn]}>
                <Text style={[styles.choiceText, a === l && { color: '#fff' }]}>{l}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setAnswer(i, '-')} style={[styles.choice, styles.choiceWide, a === '-' && styles.choiceOn]}>
              <Text style={[styles.choiceText, a === '-' && { color: '#fff' }]}>Blank</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
          {sc.score} / {sc.outOf} · {sc.percent}%
        </Text>
        {sc.recorded !== null ? (
          <Text style={{ fontSize: 15, color: colors.text }}>
            Recorded: {sc.recorded} / {outOf}
          </Text>
        ) : null}
        {sc.missing > 0 ? <Text style={{ fontSize: 14, color: colors.warning }}>{sc.missing} questions are on a page that hasn&apos;t been scanned.</Text> : null}
        <Button small variant="secondary" icon="person-outline" title="Change student" onPress={() => setPicking(true)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
      </Card>

      {flagged.length > 0 ? (
        <>
          <SectionTitle>{`To check (${flagged.length})`}</SectionTitle>
          <Text style={styles.help}>Look at what the student shaded and tap the right answer.</Text>
          {flagged.map(({ i }) => renderQuestion(i, true))}
        </>
      ) : null}

      <SectionTitle right={showAll ? undefined : <Button small variant="ghost" title="Show" onPress={() => setShowAll(true)} />}>
        All answers
      </SectionTitle>
      {showAll ? (
        <>
          <Text style={styles.help}>Tap a question to change its answer.</Text>
          {Array.from({ length: exam.question_count }, (_, i) => renderQuestion(i, editing === i))}
        </>
      ) : null}

      <Button variant="danger" icon="trash-outline" title="Delete script" onPress={remove} style={{ marginTop: space.xl }} />

      <StudentPicker
        visible={picking}
        title="Whose script is this?"
        students={students.map((s) => ({ id: s.id, name: s.full_name }))}
        taken={taken}
        laterLabel="Cancel"
        onPick={(p) => changeStudent(p.studentId, p.name)}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 13, color: colors.muted, marginBottom: space.sm },
  question: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
  },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  qNumber: { width: 36, fontSize: 16, fontWeight: '800', color: colors.text },
  qAnswer: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 60 },
  qKey: { flex: 1, fontSize: 13, color: colors.muted },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  choice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  choiceWide: { width: 72 },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
