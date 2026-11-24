import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Badge, Banner, Button, ErrorView, Field, Group, IconButton, Input, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { parseNames } from '../../lib/names';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(classId: string) {
  const [cls, students] = await Promise.all([
    supabase.from('classes').select('id, name').eq('id', classId).single().then(must),
    supabase.from('students').select('full_name').eq('class_id', classId).then(must),
  ]);
  return { cls, existing: new Set(students.map((s) => s.full_name.toLowerCase())) };
}

export default function ImportStudents() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { schoolId } = useCurrentSchool();
  const { data, loading, error, reload } = useLoad(() => load(classId), classId);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { cls, existing } = data!;

  const parsed = parseNames(text).filter((n) => !removed.has(n));
  const fresh = parsed.filter((n) => !existing.has(n.toLowerCase()));
  const already = parsed.length - fresh.length;

  async function pickFile() {
    setMessage(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (/\.(xlsx|xls|ods|numbers)$/i.test(asset.name)) {
        setMessage('Save the sheet as CSV first (File → Download → CSV), or copy the names column and paste it below.');
        return;
      }
      const content = await new File(asset.uri).text();
      setText(content);
      setFileName(asset.name);
      setRemoved(new Set());
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  async function save() {
    if (fresh.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      must(
        await supabase
          .from('students')
          .insert(fresh.map((full_name) => ({ school_id: schoolId, class_id: cls.id, full_name }))),
      );
      router.back();
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Add students to ${cls.name}` }} />
      {message ? <Banner tone="warning" icon="alert-circle" title={message} /> : null}

      <Button variant="secondary" icon="folder-open-outline" title="Pick a CSV file" onPress={pickFile} />
      {fileName ? <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.xs }}>From {fileName}</Text> : null}

      <Text style={{ textAlign: 'center', color: colors.faint, marginVertical: space.md }}>or</Text>

      <Field label="Paste names" hint="One student per line. You can copy a column from Excel, Google Sheets or WhatsApp.">
        <Input
          value={text}
          onChangeText={(t) => {
            setText(t);
            setFileName(null);
          }}
          placeholder={'Okeke Chidi\nBello Fatima\nAdeyemi Grace'}
          multiline
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      </Field>

      {parsed.length > 0 ? (
        <>
          <SectionTitle>{`Check the names (${fresh.length} new)`}</SectionTitle>
          {already > 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.sm }}>
              {already} already on the class list will be skipped.
            </Text>
          ) : null}
          <Group>
            {parsed.map((n) => (
              <ListRow
                key={n}
                title={n}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    {existing.has(n.toLowerCase()) ? <Badge label="Already added" /> : null}
                    <IconButton
                      icon="close-circle-outline"
                      label={`Leave out ${n}`}
                      onPress={() => setRemoved((prev) => new Set(prev).add(n))}
                    />
                  </View>
                }
              />
            ))}
          </Group>
        </>
      ) : null}

      <Button
        title={fresh.length > 0 ? `Add ${fresh.length} ${fresh.length === 1 ? 'student' : 'students'}` : 'Add students'}
        icon="checkmark"
        onPress={save}
        loading={busy}
        disabled={fresh.length === 0}
        style={{ marginTop: space.xl }}
      />
    </Screen>
  );
}
