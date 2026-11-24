import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UpdateBanner } from '../../components/UpdateBanner';
import { colors, space } from '../../components/theme';
import { Badge, Banner, Button, Card, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle, confirm } from '../../components/ui';
import { useSchool } from '../../lib/school';
import { scoreScript } from '../../lib/scoring';
import { formatDate } from '../../lib/sheet/render';
import { loadMyResults } from '../../lib/studentResults';
import { supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

export default function StudentHome() {
  const { studentAccounts, isOwner, refresh: refreshAccounts } = useSchool();
  // Confirmed first; otherwise the latest request (waiting for a teacher, or not confirmed).
  const me = studentAccounts.find((a) => a.status === 'approved') ?? studentAccounts[0];
  const confirmed = me?.status === 'approved';
  const { data, loading, error, reload, refresh, refreshing } = useLoad(loadMyResults, me?.id ?? '');

  async function logOut() {
    if (await confirm('Log out?', 'You can log back in with your email and password.', 'Log out')) await supabase.auth.signOut();
  }

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const results = data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        refreshing={refreshing}
        onRefresh={() => {
          refreshAccounts(); // picks up a teacher's confirmation
          refresh();
        }}
      >
        <UpdateBanner />
        <Card style={{ gap: 4 }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>Student</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{me?.studentName ?? me?.typedName}</Text>
          <Text style={{ fontSize: 15, color: colors.text }}>
            {me?.className} · {me?.schoolName}
          </Text>
        </Card>

        {me?.status === 'pending' ? (
          <Banner
            tone="info"
            icon="time-outline"
            title="Waiting for a teacher to confirm you"
            text="Your scores will show here once a teacher at your school confirms your name. Pull down to check."
            action={<Button small variant="secondary" title="Change class or name" onPress={() => router.push('/student/join')} />}
          />
        ) : null}
        {me?.status === 'declined' ? (
          <Banner
            tone="warning"
            icon="close-circle-outline"
            title="Your teacher couldn't confirm you"
            text="Check your class and name, then try again."
            action={<Button small title="Change class or name" onPress={() => router.push('/student/join')} />}
          />
        ) : null}

        <SectionTitle>Your results</SectionTitle>
        {!confirmed ? (
          <EmptyState icon="lock-closed-outline" title="Not yet" text="Your results appear here once a teacher confirms you." />
        ) : results.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No results yet" text="Your results appear here when your teacher releases them." />
        ) : (
          <Group>
            {results.map((r) => {
              const sc = scoreScript(r.answers, r.answer_key, Number(r.mark_per_question), r.record_out_of === null ? null : Number(r.record_out_of));
              return (
                <ListRow
                  key={r.exam_id}
                  icon="ribbon-outline"
                  title={r.title}
                  subtitle={[r.subject, formatDate(r.exam_date)].filter(Boolean).join(' · ')}
                  right={<Badge label={`${sc.percent}%`} tone={sc.percent >= 50 ? 'success' : 'warning'} />}
                  onPress={() => router.push({ pathname: '/student/result/[examId]', params: { examId: r.exam_id } })}
                />
              );
            })}
          </Group>
        )}

        <SectionTitle>Your timetable</SectionTitle>
        <Card>
          <Text style={{ fontSize: 14, color: colors.muted }}>Your class timetable will appear here once your school adds it.</Text>
        </Card>

        <View style={{ marginTop: space.xl, gap: space.sm }}>
          {isOwner ? <Button variant="secondary" icon="globe-outline" title="Zelvo owner dashboard" onPress={() => router.push('/owner')} /> : null}
          <Button variant="danger" icon="log-out-outline" title="Log out" onPress={logOut} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
