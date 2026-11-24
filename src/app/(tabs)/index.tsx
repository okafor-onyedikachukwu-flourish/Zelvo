import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { UpdateBanner } from '../../components/UpdateBanner';
import { Badge, Banner, Button, Card, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

type Counts = { classes: number; subjects: number; students: number; staff: number; joined: number; requests: number };

async function loadCounts(schoolId: string): Promise<Counts> {
  const count = async (table: 'classes' | 'subjects' | 'students') => {
    const res = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
    if (res.error) throw res.error;
    return res.count ?? 0;
  };
  const [classes, subjects, students, staff, requests] = await Promise.all([
    count('classes'),
    count('subjects'),
    count('students'),
    supabase.from('staff').select('user_id').eq('school_id', schoolId).then(must),
    supabase
      .from('student_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .then((r) => {
        if (r.error) throw r.error;
        return r.count ?? 0;
      }),
  ]);
  return { classes, subjects, students, staff: staff.length, joined: staff.filter((s) => s.user_id).length, requests };
}

export default function Home() {
  const { school, schoolId, fullName, role, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadCounts(schoolId), schoolId);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const c = data!;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <UpdateBanner />
      {c.requests > 0 ? (
        <Banner
          tone="info"
          icon="school-outline"
          title={`${c.requests} ${c.requests === 1 ? 'student is' : 'students are'} waiting for approval`}
          action={<Button small title="Review" onPress={() => router.push('/student-requests')} />}
        />
      ) : null}
      <Card>
        <Text style={{ fontSize: 14, color: colors.muted }}>Hello, {fullName.split(' ')[0]}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 }}>{school.name}</Text>
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <Badge label={role === 'admin' ? 'Main admin' : 'Teacher'} tone="primary" />
        </View>
      </Card>

      {isAdmin ? (
        <>
          <SectionTitle>Set up your school</SectionTitle>
          <Group>
            <Step done={c.classes > 0} title="Add classes" detail={plural(c.classes, 'class', 'classes')} href="/classes" />
            <Step done={c.subjects > 0} title="Add subjects" detail={plural(c.subjects, 'subject', 'subjects')} href="/subjects" />
            <Step
              done={c.staff > 1}
              title="Add teachers"
              detail={`${c.joined} of ${c.staff} staff have joined`}
              href="/staff"
            />
            <Step
              done={c.students > 0}
              title="Class lists (optional)"
              detail={`${plural(c.students, 'student', 'students')}. Helps Zelvo match names on scripts.`}
              href="/classes"
            />
          </Group>
        </>
      ) : (
        <>
          <SectionTitle>Your school</SectionTitle>
          <Group>
            <ListRow icon="people-outline" title="Classes" subtitle={plural(c.classes, 'class', 'classes')} onPress={() => router.push('/classes')} />
            <ListRow icon="book-outline" title="Subjects" subtitle={plural(c.subjects, 'subject', 'subjects')} onPress={() => router.push('/subjects')} />
            <ListRow icon="id-card-outline" title="Staff" subtitle={plural(c.joined, 'member', 'members')} onPress={() => router.push('/staff')} />
          </Group>
        </>
      )}

      <View style={{ marginTop: space.xl }}>
        <Banner
          tone="info"
          icon="sparkles-outline"
          title="Coming next"
          text="Scanning and marking scripts with the phone camera, then timetable alarms before every period."
        />
      </View>
    </Screen>
  );
}

function Step({ done, title, detail, href }: { done: boolean; title: string; detail: string; href: Href }) {
  return (
    <ListRow
      title={title}
      subtitle={detail}
      onPress={() => router.push(href)}
      right={<Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? colors.success : colors.faint} />}
    />
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
