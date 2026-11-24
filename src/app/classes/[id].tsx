import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import {
  Banner,
  Button,
  EmptyState,
  ErrorView,
  Group,
  IconButton,
  Input,
  ListRow,
  LoadingView,
  Screen,
  SectionTitle,
  confirm,
} from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(classId: string) {
  const [cls, students, joined] = await Promise.all([
    supabase.from('classes').select('id, name').eq('id', classId).single().then(must),
    supabase.from('students').select('id, full_name').eq('class_id', classId).order('full_name').then(must),
    supabase.from('student_accounts').select('student_id').eq('class_id', classId).eq('status', 'approved').then(must),
  ]);
  const status = new Map<string, string>();
  for (const j of joined) if (j.student_id) status.set(j.student_id, 'On Zelvo');
  return { cls, students, status, joinedCount: joined.length };
}

export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(id), id);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newStudent, setNewStudent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { cls, students, status, joinedCount } = data!;
  const q = search.trim().toLowerCase();
  const shown = q ? students.filter((s) => s.full_name.toLowerCase().includes(q)) : students;

  async function attempt(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    attempt(async () => {
      const name = (renaming ?? '').trim();
      if (!name) throw new Error('Enter a class name.');
      must(await supabase.from('classes').update({ name }).eq('id', cls.id).select('id').single());
      setRenaming(null);
      await reload();
    });

  const addStudent = () =>
    attempt(async () => {
      const name = newStudent.replace(/\s+/g, ' ').trim();
      if (name.length < 2) throw new Error("Enter the student's full name.");
      if (students.some((s) => s.full_name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`${name} is already in this class.`);
      }
      must(await supabase.from('students').insert({ school_id: schoolId, class_id: cls.id, full_name: name }));
      setNewStudent('');
      await reload();
    });

  const removeStudent = (s: { id: string; full_name: string }) =>
    attempt(async () => {
      if (!(await confirm(`Remove ${s.full_name}?`, `They will be taken off the ${cls.name} list.`, 'Remove'))) return;
      must(await supabase.from('students').delete().eq('id', s.id));
      await reload();
    });

  const deleteClass = () =>
    attempt(async () => {
      const extra = students.length > 0 ? ` Its list of ${students.length} students will be deleted too.` : '';
      if (!(await confirm(`Delete ${cls.name}?`, `This can't be undone.${extra}`))) return;
      must(await supabase.from('classes').delete().eq('id', cls.id));
      router.back();
    });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: cls.name }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      {isAdmin && renaming !== null ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Input value={renaming} onChangeText={setRenaming} style={{ flex: 1 }} autoFocus onSubmitEditing={saveName} />
          <Button small title="Save" onPress={saveName} loading={busy} />
          <Button small variant="ghost" title="Cancel" onPress={() => setRenaming(null)} />
        </View>
      ) : null}

      {isAdmin ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button
            small
            icon="document-text-outline"
            title="Add class list"
            onPress={() => router.push({ pathname: '/classes/import', params: { classId: cls.id } })}
          />
          <Button small variant="secondary" icon="create-outline" title="Rename" onPress={() => setRenaming(cls.name)} />
        </View>
      ) : null}

      <SectionTitle>
        {`${students.length} ${students.length === 1 ? 'student' : 'students'}` + (joinedCount > 0 ? ` · ${joinedCount} on Zelvo` : '')}
      </SectionTitle>

      {isAdmin ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Input
            value={newStudent}
            onChangeText={setNewStudent}
            placeholder="Add one student"
            style={{ flex: 1 }}
            onSubmitEditing={addStudent}
          />
          <Button title="Add" onPress={addStudent} disabled={newStudent.trim().length < 2} />
        </View>
      ) : null}

      {students.length > 15 ? (
        <Input value={search} onChangeText={setSearch} placeholder="Search this class" style={{ marginBottom: space.md }} />
      ) : null}

      {students.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No class list"
          text="A class list is optional. With one, Zelvo matches the names students write on their scripts to the right person. Students who join Zelvo are added when a teacher confirms them."
        />
      ) : (
        <Group>
          {shown.map((s, i) => (
            <ListRow
              key={s.id}
              title={s.full_name}
              subtitle={status.get(s.id)}
              right={
                isAdmin ? (
                  <IconButton icon="trash-outline" label={`Remove ${s.full_name}`} onPress={() => removeStudent(s)} />
                ) : (
                  <Text style={{ color: colors.faint }}>{i + 1}</Text>
                )
              }
            />
          ))}
        </Group>
      )}

      {isAdmin ? (
        <Button variant="danger" icon="trash-outline" title="Delete class" onPress={deleteClass} style={{ marginTop: space.xl }} />
      ) : null}
    </Screen>
  );
}
