import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PhotoScreen, useLightStatusBar } from '../../components/Photo';
import { UpdateBanner } from '../../components/UpdateBanner';
import { colors, radius, space } from '../../components/theme';
import { Banner, Button, EmptyState, ErrorView, Group, ListRow, LoadingView, SectionTitle, confirm } from '../../components/ui';
import { PHOTOS } from '../../lib/photos';
import { useSchool } from '../../lib/school';
import { scoreScript } from '../../lib/scoring';
import { formatDate } from '../../lib/sheet/render';
import { loadMyResults } from '../../lib/studentResults';
import { supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

const TINTS = [
  { bg: colors.primarySoft, fg: colors.primary },
  { bg: colors.accentSoft, fg: colors.accentText },
  { bg: colors.successSoft, fg: colors.success },
  { bg: colors.infoSoft, fg: colors.info },
];

/** "Mathematics" → "MAT"; the same subject always gets the same colour. */
function subjectBadge(subject: string | null) {
  const name = (subject ?? '').trim();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return { label: name.slice(0, 3).toUpperCase() || '—', ...TINTS[h % TINTS.length] };
}

/** A ring that fills up to the average. */
function Ring({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Average ${p} percent`}>
      <Svg width={68} height={68} viewBox="0 0 68 68" style={{ position: 'absolute' }}>
        <Circle cx={34} cy={34} r={r} stroke={colors.primarySoft} strokeWidth={8} fill="none" />
        <Circle
          cx={34}
          cy={34}
          r={r}
          stroke={colors.primary}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          transform="rotate(-90 34 34)"
        />
      </Svg>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{p}%</Text>
    </View>
  );
}

export default function StudentHome() {
  const { studentAccounts, isOwner, refresh: refreshAccounts } = useSchool();
  // Confirmed first; otherwise the latest request (waiting for a teacher, or not confirmed).
  const me = studentAccounts.find((a) => a.status === 'approved') ?? studentAccounts[0];
  const confirmed = me?.status === 'approved';
  const { data, loading, error, reload, refresh, refreshing } = useLoad(loadMyResults, me?.id ?? '');
  useLightStatusBar();

  async function logOut() {
    if (await confirm('Log out?', 'You can log back in with your email and password.', 'Log out')) await supabase.auth.signOut();
  }

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const results = (data ?? []).map((r) => ({
    ...r,
    score: scoreScript(r.answers, r.answer_key, Number(r.mark_per_question), r.record_out_of === null ? null : Number(r.record_out_of)),
  }));
  const average = results.length ? Math.round(results.reduce((sum, r) => sum + r.score.percent, 0) / results.length) : 0;

  return (
    <PhotoScreen
      photo={PHOTOS.students}
      refreshing={refreshing}
      onRefresh={() => {
        refreshAccounts(); // picks up a teacher's confirmation
        refresh();
      }}
      header={
        <View>
          <Text style={{ fontSize: 25, lineHeight: 31, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 }}>{me?.studentName ?? me?.typedName}</Text>
          <Text style={{ fontSize: 15, color: '#D6F0E2', fontWeight: '500' }}>
            {me?.className} · {me?.schoolName}
          </Text>
        </View>
      }
    >
      <UpdateBanner />

      {me?.status === 'pending' ? (
        <Banner
          tone="info"
          icon="time-outline"
          title="Waiting for a teacher to confirm you"
          text="Your scores show here once a teacher confirms your name. Pull down to check."
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

      {!confirmed ? (
        <EmptyState icon="lock-closed-outline" photo={PHOTOS.books} title="Your results will appear here" text="After a teacher confirms you and releases the marks." />
      ) : results.length === 0 ? (
        <EmptyState icon="document-text-outline" photo={PHOTOS.books} title="No results yet" text="Your results appear here when your teacher releases them." />
      ) : (
        <>
          <View style={styles.summary}>
            <Ring percent={average} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Your average</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                From {results.length} released {results.length === 1 ? 'result' : 'results'}
              </Text>
            </View>
          </View>

          <SectionTitle>Your results</SectionTitle>
          {results.map((r) => {
            const b = subjectBadge(r.subject);
            const good = r.score.percent >= 50;
            return (
              <ListRowCard
                key={r.exam_id}
                badge={b}
                title={r.title}
                subtitle={[r.subject, formatDate(r.exam_date)].filter(Boolean).join(' · ')}
                percent={r.score.percent}
                good={good}
                onPress={() => router.push({ pathname: '/student/result/[examId]', params: { examId: r.exam_id } })}
              />
            );
          })}
        </>
      )}

      <SectionTitle>Today</SectionTitle>
      <View style={styles.today}>
        <Text style={{ flex: 1, fontSize: 14, color: colors.muted }}>Your class timetable will show here once your school adds it.</Text>
        <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primaryDark }}>Soon</Text>
        </View>
      </View>

      <View style={{ marginTop: space.lg }}>
        <Group>
          {isOwner ? <ListRow icon="globe-outline" title="Zelvo owner dashboard" onPress={() => router.push('/owner')} /> : null}
          <ListRow icon="log-out-outline" title="Log out" onPress={logOut} />
        </Group>
      </View>
    </PhotoScreen>
  );
}

function ListRowCard({
  badge,
  title,
  subtitle,
  percent,
  good,
  onPress,
}: {
  badge: { label: string; bg: string; fg: string };
  title: string;
  subtitle: string;
  percent: number;
  good: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.resultCard}>
      <ListRow title={title} subtitle={subtitle} onPress={onPress} right={
        <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: good ? colors.successSoft : colors.accentSoft }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: good ? colors.success : colors.accentText }}>{percent}%</Text>
        </View>
      } />
      <View style={[styles.badge, { backgroundColor: badge.bg }]} pointerEvents="none">
        <Text style={{ fontSize: 12, fontWeight: '800', color: badge.fg }}>{badge.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultCard: {
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingLeft: 52,
    marginBottom: space.sm,
  },
  badge: {
    position: 'absolute',
    left: 14,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
