import { useState } from 'react';
import { Text, View } from 'react-native';
import { AddNamesBox } from '../components/AddNamesBox';
import { colors, space } from '../components/theme';
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
} from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';

async function load(schoolId: string) {
  return must(await supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'));
}

export default function Subjects() {
  const { schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId), schoolId);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function attempt(action: () => Promise<void>): Promise<boolean> {
    setMessage(null);
    try {
      await action();
      return true;
    } catch (e) {
      setMessage(friendlyError(e));
      return false;
    }
  }

  const add = (names: string[]) =>
    attempt(async () => {
      must(await supabase.from('subjects').insert(names.map((name) => ({ school_id: schoolId, name }))));
      await reload();
    });

  const saveEdit = () =>
    attempt(async () => {
      if (!editing) return;
      const name = editing.name.trim();
      if (!name) throw new Error('Enter a department name.');
      must(await supabase.from('subjects').update({ name }).eq('id', editing.id).select('id').single());
      setEditing(null);
      await reload();
    });

  const remove = (s: { id: string; name: string }) =>
    attempt(async () => {
      if (!(await confirm(`Delete ${s.name}?`, "This can't be undone."))) return;
      must(await supabase.from('subjects').delete().eq('id', s.id));
      await reload();
    });

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const subjects = data ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      {isAdmin ? (
        <>
          <AddNamesBox placeholder="e.g. Mathematics, English, Biology" onAdd={add} />
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: space.xs }}>
            Each department is one subject. Add several at once by separating them with commas. Heads of department and
            teachers choose from this list when they join.
          </Text>
        </>
      ) : null}

      {subjects.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="No departments yet"
          text={isAdmin ? 'Add the departments (subjects) taught in your school.' : 'Your vice-principal academic hasn’t added departments yet.'}
        />
      ) : (
        <>
          <SectionTitle>{`${subjects.length} ${subjects.length === 1 ? 'department' : 'departments'}`}</SectionTitle>
          <Group>
            {subjects.map((s) =>
              editing?.id === s.id ? (
                <View key={s.id} style={{ flexDirection: 'row', gap: space.sm, padding: space.md, alignItems: 'center' }}>
                  <Input
                    value={editing.name}
                    onChangeText={(name) => setEditing({ id: s.id, name })}
                    style={{ flex: 1 }}
                    autoFocus
                    onSubmitEditing={saveEdit}
                  />
                  <Button small title="Save" onPress={saveEdit} />
                  <IconButton icon="close" label="Cancel" onPress={() => setEditing(null)} />
                </View>
              ) : (
                <ListRow
                  key={s.id}
                  icon="book-outline"
                  title={s.name}
                  right={
                    isAdmin ? (
                      <View style={{ flexDirection: 'row' }}>
                        <IconButton icon="create-outline" label={`Rename ${s.name}`} onPress={() => setEditing({ id: s.id, name: s.name })} />
                        <IconButton icon="trash-outline" label={`Delete ${s.name}`} onPress={() => remove(s)} />
                      </View>
                    ) : undefined
                  }
                />
              ),
            )}
          </Group>
        </>
      )}
    </Screen>
  );
}
