import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../../components/theme';
import { Banner, Button, Card, Chip, ErrorView, Field, Input, LoadingView, Screen } from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { useCurrentSchool } from '../../../lib/school';
import { gridShape, pageCount } from '../../../lib/sheet/layout';
import { sheetsHtml, type SheetExam } from '../../../lib/sheet/render';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

// A4 in points (72 per inch).
const A4 = { width: 595, height: 842 };

async function load(id: string) {
  const exam = must(
    await supabase
      .from('exams')
      .select('id, title, exam_date, question_count, option_count, mark_per_question, class_id, classes(name), subjects(name)')
      .eq('id', id)
      .single(),
  );
  const students = must(
    await supabase.from('students').select('id, full_name').eq('class_id', exam.class_id).order('full_name'),
  );
  return { exam, students };
}

export default function AnswerSheets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { school } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => load(id), id);
  const [mode, setMode] = useState<'named' | 'blank' | null>(null);
  const [copies, setCopies] = useState('1');
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { exam, students } = data!;
  const className = exam.classes?.name ?? '';
  const subjectName = exam.subjects?.name ?? '';
  const chosen = mode ?? (students.length > 0 ? 'named' : 'blank');
  const pages = pageCount(exam.question_count, exam.option_count);
  const copyCount = Math.min(200, Math.max(1, Number(copies) || 1));
  const totalPages = chosen === 'named' ? students.length * pages : copyCount * pages;

  const sheetExam: SheetExam = {
    id: exam.id,
    title: exam.title,
    examDate: exam.exam_date,
    questionCount: exam.question_count,
    optionCount: exam.option_count,
    markPerQuestion: Number(exam.mark_per_question),
    className,
    subjectName,
    schoolName: school.name,
  };

  const html = () =>
    sheetsHtml(
      sheetExam,
      chosen === 'named' ? students.map((s) => ({ id: s.id, name: s.full_name })) : null,
      copyCount,
    );

  async function print() {
    setBusy('print');
    setMessage(null);
    try {
      await Print.printAsync({ html: html(), ...A4 });
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy('share');
    setMessage(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: html(), ...A4 });
      const name = `${subjectName} ${className} - ${exam.title} - answer sheets.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');
      const target = new File(Paths.cache, name);
      if (target.exists) target.delete();
      await new File(uri).move(target);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
      await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Share answer sheets', UTI: 'com.adobe.pdf' });
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Answer sheets' }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card style={{ gap: 4 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{exam.title}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {subjectName} · {className} · {exam.question_count} questions
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          A4, {pages} {pages === 1 ? 'page' : 'pages'} per student (up to {gridShape(exam.option_count).perPage} questions a page)
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.lg }}>
        <Chip
          label={`Named (${students.length})`}
          selected={chosen === 'named'}
          onPress={() => (students.length > 0 ? setMode('named') : setMessage(`${className} has no class list yet. Add one under School → Classes.`))}
        />
        <Chip label="Blank" selected={chosen === 'blank'} onPress={() => setMode('blank')} />
      </View>

      {chosen === 'named' ? (
        <Text style={{ fontSize: 14, color: colors.text, marginBottom: space.lg }}>
          One sheet for each of the {students.length} students on the {className} list, with their name already printed. Zelvo
          knows whose script it is without reading handwriting.
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 14, color: colors.text, marginBottom: space.md }}>
            Sheets with empty boxes for the student’s name, class and subject. When scanning, Zelvo reads the handwritten name
            {students.length > 0 ? ` and matches it to the ${className} list` : ''}.
          </Text>
          <Field label="Copies" hint="Or print one and photocopy it. Every copy is the same.">
            <Input
              value={copies}
              onChangeText={(t) => setCopies(t.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              style={{ width: 100 }}
            />
          </Field>
        </>
      )}

      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.md }}>
        {totalPages} {totalPages === 1 ? 'page' : 'pages'} in total. Print on white A4 paper.
      </Text>

      <Button title="Print" icon="print-outline" onPress={print} loading={busy === 'print'} disabled={busy !== null} />
      <Button
        variant="secondary"
        icon="share-social-outline"
        title="Share PDF (e.g. to a print shop)"
        onPress={share}
        loading={busy === 'share'}
        disabled={busy !== null}
        style={{ marginTop: space.sm }}
      />
    </Screen>
  );
}
