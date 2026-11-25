import { router } from 'expo-router';
import { Badge, Banner, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(schoolId: string) {
  const [staff, classes, subjects, accounts] = await Promise.all([
    supabase.from('staff').select('user_id').eq('school_id', schoolId).not('user_id', 'is', null).then(must),
    supabase.from('classes').select('id').eq('school_id', schoolId).then(must),
    supabase.from('subjects').select('id').eq('school_id', schoolId).then(must),
    supabase.from('student_accounts').select('status').eq('school_id', schoolId).then(must),
  ]);
  return {
    staff: staff.length,
    classes: classes.length,
    subjects: subjects.length,
    pending: accounts.filter((a) => a.status === 'pending').length,
    students: accounts.filter((a) => a.status === 'approved').length,
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
        <Banner tone="info" icon="eye-outline" title="View only" text="Only the principal or vice-principal can change these." />
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
          subtitle={`${c.staff} ${c.staff === 1 ? 'person' : 'people'}`}
          onPress={() => router.push('/staff')}
        />
        <ListRow icon="people-outline" title="Classes and students" subtitle={`${c.classes} classes`} onPress={() => router.push('/classes')} />
        <ListRow icon="book-outline" title="Departments" subtitle={`${c.subjects} departments`} onPress={() => router.push('/subjects')} />
        <ListRow icon="calendar-outline" title="Timetable" subtitle="Bell times and lessons" onPress={() => router.push('/timetable')} />
        <ListRow
          icon="school-outline"
          title="Students on Zelvo"
          subtitle={c.pending > 0 ? `${c.pending} waiting for a teacher · ${c.students} confirmed` : `${c.students} confirmed`}
          right={c.pending > 0 ? <Badge label={String(c.pending)} tone="warning" /> : undefined}
          onPress={() => router.push('/student-requests')}
        />
      </Group>
    </Screen>
  );
}
