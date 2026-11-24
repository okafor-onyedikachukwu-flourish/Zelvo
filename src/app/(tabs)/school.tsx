import { router } from 'expo-router';
import { Banner, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(schoolId: string) {
  const [staff, classes, subjects] = await Promise.all([
    supabase.from('staff').select('user_id').eq('school_id', schoolId).then(must),
    supabase.from('classes').select('id').eq('school_id', schoolId).then(must),
    supabase.from('subjects').select('id').eq('school_id', schoolId).then(must),
  ]);
  return {
    staff: staff.length,
    waiting: staff.filter((s) => !s.user_id).length,
    classes: classes.length,
    subjects: subjects.length,
  };
}

export default function SchoolTab() {
  const { school, schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId), schoolId);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const c = data!;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {!isAdmin ? (
        <Banner tone="info" icon="eye-outline" title="View only" text="Only school admins can change these." />
      ) : null}
      <Group>
        <ListRow
          icon="business-outline"
          title={school.name}
          subtitle={[school.country, school.timezone].filter(Boolean).join(' · ')}
          onPress={() => router.push('/school-details')}
        />
      </Group>

      <SectionTitle>People and classes</SectionTitle>
      <Group>
        <ListRow
          icon="id-card-outline"
          title="Staff"
          subtitle={c.waiting > 0 ? `${c.staff} people, ${c.waiting} not joined yet` : `${c.staff} people`}
          onPress={() => router.push('/staff')}
        />
        <ListRow icon="people-outline" title="Classes and students" subtitle={`${c.classes} classes`} onPress={() => router.push('/classes')} />
        <ListRow icon="book-outline" title="Subjects" subtitle={`${c.subjects} subjects`} onPress={() => router.push('/subjects')} />
      </Group>
    </Screen>
  );
}
