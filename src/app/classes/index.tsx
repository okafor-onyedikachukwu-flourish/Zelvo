import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AddNamesBox } from '../../components/AddNamesBox';
import { colors, space } from '../../components/theme';
import { Banner, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';
import { PHOTOS } from '../../lib/photos';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

async function load(schoolId: string) {
  const [rows, counts] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', schoolId).then(must),
    supabase.rpc('class_student_counts', { p_school: schoolId }).then(must),
  ]);
  const byClass = new Map(counts.map((c) => [c.class_id, c.students]));
  return rows.map((r) => ({ id: r.id, name: r.name, students: byClass.get(r.id) ?? 0 })).sort(byName);
}

export default function Classes() {
  const { schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId), schoolId);
  const [addError, setAddError] = useState<string | null>(null);

  async function add(names: string[]) {
    setAddError(null);
    try {
      must(await supabase.from('classes').insert(names.map((name) => ({ school_id: schoolId, name }))));
      await reload();
      return true;
    } catch (e) {
      setAddError(friendlyError(e));
      return false;
    }
  }

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const classes = data ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {isAdmin ? (
        <>
          {addError ? <Banner tone="danger" icon="alert-circle" title={addError} /> : null}
          <AddNamesBox placeholder="e.g. JSS1A, JSS1B, SS2 Science" onAdd={add} />
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: space.xs }}>
            Add several at once by separating them with commas.
          </Text>
        </>
      ) : null}

      {classes.length === 0 ? (
        <EmptyState photo={PHOTOS.classroom}
          icon="people-outline"
          title="No classes yet"
          text={isAdmin ? 'Add the classes in your school, such as JSS1A or Grade 7 Blue.' : 'Your principal or vice-principal hasn’t added classes yet.'}
        />
      ) : (
        <>
          <SectionTitle>{`${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}</SectionTitle>
          <Group>
            {classes.map((c) => (
              <ListRow
                key={c.id}
                icon="people-outline"
                title={c.name}
                subtitle={c.students === 0 ? 'No class list' : `${c.students} ${c.students === 1 ? 'student' : 'students'}`}
                onPress={() => router.push({ pathname: '/classes/[id]', params: { id: c.id } })}
              />
            ))}
          </Group>
        </>
      )}
    </Screen>
  );
}
