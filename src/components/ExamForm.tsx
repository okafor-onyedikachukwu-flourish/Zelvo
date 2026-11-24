import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MAX_QUESTIONS, optionsLabel } from '../lib/exams';
import { friendlyError } from '../lib/errors';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { DateField } from './DateField';
import { colors, space } from './theme';
import { Banner, Button, Chip, EmptyState, ErrorView, Field, Input, LoadingView, Screen } from './ui';

export type ExamValues = {
  title: string;
  classId: string;
  subjectId: string;
  examDate: string | null;
  questionCount: number;
  optionCount: number;
  markPerQuestion: number;
  recordOutOf: number | null;
};

async function loadChoices(schoolId: string) {
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const [classes, subjects] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', schoolId).then(must),
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).then(must),
  ]);
  return { classes: classes.sort(byName), subjects: subjects.sort(byName) };
}

export function ExamForm({
  initial,
  submitLabel,
  note,
  onSubmit,
}: {
  initial?: ExamValues;
  submitLabel: string;
  /** Shown above the button, e.g. a warning when editing. */
  note?: string;
  onSubmit: (values: ExamValues) => Promise<void>;
}) {
  const { schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => loadChoices(schoolId), schoolId);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [classId, setClassId] = useState(initial?.classId ?? '');
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '');
  const [examDate, setExamDate] = useState<string | null>(initial?.examDate ?? null);
  const [questions, setQuestions] = useState(initial ? String(initial.questionCount) : '');
  const [optionCount, setOptionCount] = useState(initial?.optionCount ?? 4);
  const [mark, setMark] = useState(initial ? String(initial.markPerQuestion) : '1');
  const [recordOutOf, setRecordOutOf] = useState(initial?.recordOutOf ? String(initial.recordOutOf) : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { classes, subjects } = data!;

  if (classes.length === 0 || subjects.length === 0) {
    const missing = classes.length === 0 && subjects.length === 0 ? 'classes and subjects' : classes.length === 0 ? 'classes' : 'subjects';
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title={`No ${missing} yet`}
          text={isAdmin ? `Add your school's ${missing} first, then come back to create the exam.` : `Ask your vice-principal academic to add ${missing} first.`}
          action={
            isAdmin ? (
              <Button
                title={classes.length === 0 ? 'Add classes' : 'Add subjects'}
                onPress={() => router.push(classes.length === 0 ? '/classes' : '/subjects')}
              />
            ) : undefined
          }
        />
      </Screen>
    );
  }

  async function submit() {
    const count = Number(questions);
    const markValue = Number(mark.replace(',', '.'));
    if (title.trim().length < 2) return setMessage('Give the exam a title, e.g. "First Term Examination".');
    if (!classId) return setMessage('Choose the class.');
    if (!subjectId) return setMessage('Choose the subject.');
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      return setMessage(`Enter the number of questions (1 to ${MAX_QUESTIONS}).`);
    }
    if (!(markValue > 0) || markValue > 1000) return setMessage('Enter the mark for each question, e.g. 1 or 0.5.');
    const recordValue = recordOutOf.trim() ? Number(recordOutOf.replace(',', '.')) : null;
    if (recordValue !== null && (!(recordValue > 0) || recordValue > 10000)) {
      return setMessage('"Record out of" must be a number, e.g. 30. Leave it empty to keep the raw score.');
    }
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit({
        title: title.trim(),
        classId,
        subjectId,
        examDate,
        questionCount: count,
        optionCount,
        markPerQuestion: Math.round(markValue * 100) / 100,
        recordOutOf: recordValue === null ? null : Math.round(recordValue * 100) / 100,
      });
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  const count = Number(questions);
  const markValue = Number(mark.replace(',', '.'));
  const total = Number.isInteger(count) && count > 0 && markValue > 0 ? Math.round(count * markValue * 100) / 100 : null;

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      <Field label="Title">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. First Term Examination" />
      </Field>
      <Field label="Class">
        <ChipRow items={classes} selected={classId} onSelect={setClassId} />
      </Field>
      <Field label="Subject">
        <ChipRow items={subjects} selected={subjectId} onSelect={setSubjectId} />
      </Field>
      <Field label="Date (optional)">
        <DateField value={examDate} onChange={setExamDate} />
      </Field>
      <Field label="Number of objective questions">
        <Input value={questions} onChangeText={(t) => setQuestions(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 40" />
      </Field>
      <Field label="Options per question">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} label={optionsLabel(n)} selected={optionCount === n} onPress={() => setOptionCount(n)} />
          ))}
        </View>
      </Field>
      <Field label="Mark for each question" hint={total !== null ? `Total: ${total} marks` : undefined}>
        <Input value={mark} onChangeText={setMark} keyboardType="decimal-pad" placeholder="1" />
      </Field>
      <Field
        label="Record out of (optional)"
        hint={total !== null ? `e.g. 30 for a CA test: a score of ${total} becomes 30. Leave empty to keep the raw score.` : 'e.g. 30 for a CA test. Leave empty to keep the raw score.'}
      >
        <Input value={recordOutOf} onChangeText={setRecordOutOf} keyboardType="decimal-pad" placeholder="Raw score" />
      </Field>
      {note ? <Text style={{ fontSize: 13, color: colors.warning, marginBottom: space.md }}>{note}</Text> : null}
      <Button title={submitLabel} icon="checkmark" onPress={submit} loading={busy} />
    </Screen>
  );
}

function ChipRow({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((it) => (
        <Chip key={it.id} label={it.name} selected={selected === it.id} onPress={() => onSelect(it.id)} />
      ))}
    </View>
  );
}
