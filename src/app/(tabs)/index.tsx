import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { UpdateBanner } from '../../components/UpdateBanner';
import { Badge, Banner, Button, Card, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { roleLabel, useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

type Counts = { classes: number; subjects: number; students: number; staff: number; requests: number; staffRequests: number };

async function loadCounts(schoolId: string, isAdmin: boolean): Promise<Counts> {
  const count = async (table: 'classes' | 'subjects' | 'students') => {
    const res = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
    if (res.error) throw res.error;
    return res.count ?? 0;
  };
  const [classes, subjects, students, staff, requests, staffRequests] = await Promise.all([
    count('classes'),
    count('subjects'),
    count('students'),
    supabase.from('staff').select('user_id').eq('school_id', schoolId).not('user_id', 'is', null).then(must),
    supabase
      .from('student_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .then((r) => {
        if (r.error) throw r.error;
        return r.count ?? 0;
      }),
    isAdmin
      ? supabase
          .from('staff_requests')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'pending')
          .then((r) => {
            if (r.error) throw r.error;
            return r.count ?? 0;
          })
      : Promise.resolve(0),
  ]);
  return { classes, subjects, students, staff: staff.length, requests, staffRequests };
}

export default function Home() {
  const { school, schoolId, fullName, role, headTitle, isAdmin, isHod } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadCounts(schoolId, isAdmin), `${schoolId}:${isAdmin}`);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const c = data!;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <UpdateBanner />
      {c.staffRequests > 0 ? (
        <Banner
          tone="info"
          icon="people-outline"
          title={`${c.staffRequests} ${c.staffRequests === 1 ? 'person is' : 'people are'} asking to join your staff`}
          action={<Button small title="Review" onPress={() => router.push('/staff')} />}
        />
      ) : null}
      {c.requests > 0 ? (
        <Banner
          tone="info"
          icon="school-outline"
          title={`${c.requests} ${c.requests === 1 ? 'student is' : 'students are'} waiting for a teacher to confirm them`}
          action={<Button small title="Review" onPress={() => router.push('/student-requests')} />}
        />
      ) : null}
      <Card>
        <Text style={{ fontSize: 14, color: colors.muted }}>Hello, {fullName.split(' ')[0]}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 }}>{school.name}</Text>
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <Badge label={roleLabel(role, null, headTitle)} tone="primary" />
        </View>
      </Card>

      <View style={{ marginTop: space.md }}>
        <Group>
          <ListRow
            icon="stats-chart-outline"
            title={isAdmin ? 'School performance' : isHod ? 'Department performance' : 'My exams performance'}
            subtitle={isAdmin ? 'Average scores, class by class' : isHod ? 'Your department in every class' : 'Averages for the exams you set'}
            onPress={() => router.push('/performance')}
          />
        </Group>
      </View>

      {isAdmin ? (
        <>
          <SectionTitle>Set up your school</SectionTitle>
          <Group>
            <Step done={c.classes > 0} title="Add classes" detail={plural(c.classes, 'class', 'classes')} href="/classes" />
            <Step
              done={c.subjects > 0}
              title="Add departments"
              detail={`${plural(c.subjects, 'department', 'departments')}. Staff choose from these when they join.`}
              href="/subjects"
            />
            <Step
              done={c.staff > 1}
              title="Approve your staff"
              detail={`${plural(c.staff, 'person', 'people')} on Zelvo. Staff join from their own phones.`}
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
            <ListRow icon="book-outline" title="Departments" subtitle={plural(c.subjects, 'department', 'departments')} onPress={() => router.push('/subjects')} />
            <ListRow icon="id-card-outline" title="Staff" subtitle={plural(c.staff, 'member', 'members')} onPress={() => router.push('/staff')} />
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
