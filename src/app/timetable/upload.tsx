import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, ErrorView, LoadingView, Screen, SectionTitle, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { loadTimetable } from '../../lib/timetable';
import { checkRows, clashesWithExisting, readSheetRows, shareTemplate, type SheetCheck } from '../../lib/timetableSheet';
import { useLoad } from '../../lib/useLoad';

const SHOW = 25;

export default function UploadTimetable() {
  const { schoolId, school } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => loadTimetable(schoolId), schoolId);
  const [fileName, setFileName] = useState<string | null>(null);
  const [check, setCheck] = useState<SheetCheck | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const tt = data!;

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const template = () => run('template', () => shareTemplate(tt, school.name));

  const pick = () =>
    run('pick', async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!/\.(xlsx|xls|ods|csv|txt)$/i.test(asset.name)) throw new Error('Choose an Excel (.xlsx) or CSV file.');
      const rows = await readSheetRows(asset.uri, asset.name);
      setFileName(asset.name);
      setCheck(checkRows(rows, tt));
    });

  const clashing = check ? clashesWithExisting(check.lessons, tt.lessons) : new Set<number>();
  const strip = (d: SheetCheck['lessons'][number]) => ({
    day: d.day,
    period_id: d.period_id,
    class_id: d.class_id,
    subject_id: d.subject_id,
    teacher_id: d.teacher_id,
    room: d.room,
  });

  const replaceAll = () =>
    run('replace', async () => {
      if (!check) return;
      const ok = await confirm(
        'Replace the whole timetable?',
        `The ${tt.lessons.length} lessons there now will be removed and these ${check.lessons.length} added instead.`,
        'Replace',
      );
      if (!ok) return;
      must(await supabase.rpc('import_lessons', { p_school: schoolId, p_lessons: check.lessons.map(strip), p_replace: true }));
      router.back();
    });

  const addToIt = () =>
    run('add', async () => {
      if (!check) return;
      const fresh = check.lessons.filter((d) => !clashing.has(d.row));
      if (fresh.length === 0) throw new Error('Every lesson in the file clashes with one already in the timetable.');
      must(await supabase.rpc('import_lessons', { p_school: schoolId, p_lessons: fresh.map(strip), p_replace: false }));
      router.back();
    });

  if (tt.periods.length === 0) {
    return (
      <Screen>
        <Banner tone="warning" icon="time-outline" title="Set the bell times first" text="The spreadsheet's periods are matched to your bell times." />
        <Button title="Set the bell times" onPress={() => router.replace('/timetable/bells')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <SectionTitle>1. Get the template</SectionTitle>
      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: space.md }}>
        An Excel file with the columns Day, Period, Class, Subject, Teacher and Room, and a second sheet listing the exact names
        Zelvo knows. Open it in Excel or Google Sheets, add one row per lesson, then save it.
      </Text>
      <Button variant="secondary" icon="download-outline" title="Get the Excel template" onPress={template} loading={busy === 'template'} />

      <SectionTitle>2. Upload it</SectionTitle>
      <Button icon="cloud-upload-outline" title={fileName ? 'Choose another file' : 'Choose the filled spreadsheet'} onPress={pick} loading={busy === 'pick'} />

      {check ? (
        <>
          <Card style={{ marginTop: space.lg, gap: 4 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>{fileName}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
              {check.lessons.length} {check.lessons.length === 1 ? 'lesson' : 'lessons'} ready
            </Text>
            {check.problems.length > 0 ? (
              <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '600' }}>
                {check.problems.length} {check.problems.length === 1 ? 'row' : 'rows'} can&apos;t be used (below)
              </Text>
            ) : null}
            {tt.lessons.length > 0 && clashing.size > 0 ? (
              <Text style={{ fontSize: 14, color: colors.warning, fontWeight: '600' }}>
                {clashing.size} clash with lessons already in the timetable
              </Text>
            ) : null}
          </Card>

          {check.problems.length > 0 ? (
            <>
              <SectionTitle>Rows that can&apos;t be used</SectionTitle>
              <Card style={{ gap: 6 }}>
                {check.problems.slice(0, SHOW).map((p) => (
                  <Text key={`p${p.row}`} style={{ fontSize: 14, color: colors.text }}>
                    <Text style={{ fontWeight: '700' }}>Row {p.row}: </Text>
                    {p.text}
                  </Text>
                ))}
                {check.problems.length > SHOW ? (
                  <Text style={{ fontSize: 13, color: colors.muted }}>…and {check.problems.length - SHOW} more.</Text>
                ) : null}
              </Card>
            </>
          ) : null}
          {check.notes.length > 0 ? (
            <>
              <SectionTitle>Notes</SectionTitle>
              <Card style={{ gap: 6 }}>
                {check.notes.slice(0, SHOW).map((p) => (
                  <Text key={`n${p.row}`} style={{ fontSize: 14, color: colors.text }}>
                    <Text style={{ fontWeight: '700' }}>Row {p.row}: </Text>
                    {p.text}
                  </Text>
                ))}
              </Card>
            </>
          ) : null}

          {check.lessons.length > 0 ? (
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              <Button title="Replace the whole timetable" onPress={replaceAll} loading={busy === 'replace'} />
              {tt.lessons.length > 0 ? (
                <Button
                  variant="secondary"
                  title={clashing.size > 0 ? `Add the ${check.lessons.length - clashing.size} that don't clash` : 'Add to the timetable'}
                  onPress={addToIt}
                  loading={busy === 'add'}
                />
              ) : null}
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Fix the rows above in the spreadsheet and upload it again if you want them included.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
