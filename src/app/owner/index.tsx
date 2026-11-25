import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart, ProgressBar } from '../../components/BarChart';
import { PhotoScreen, useLightStatusBar } from '../../components/Photo';
import { colors, radius, space } from '../../components/theme';
import { Badge, Button, Chip, EmptyState, ErrorView, Input, LoadingView, SectionTitle, type IconName } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { greeting, loadOwnerDashboard, MINUTES_SAVED_PER_SCRIPT, nextMilestone, sinceText, type Week } from '../../lib/owner';
import { PHOTOS } from '../../lib/photos';
import { currentBuild } from '../../lib/updates';
import { useLoad } from '../../lib/useLoad';

type Metric = { key: keyof Omit<Week, 'week'>; label: string };
const METRICS: Metric[] = [
  { key: 'accounts', label: 'New accounts' },
  { key: 'active', label: 'People using Zelvo' },
  { key: 'scripts', label: 'Scripts marked' },
  { key: 'schools', label: 'New schools' },
];

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function OwnerDashboard() {
  const { session } = useAuth();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(loadOwnerDashboard, 'owner');
  const [metric, setMetric] = useState<Metric>(METRICS[0]);
  const [query, setQuery] = useState('');
  useLightStatusBar();

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { stats, schools, announcements } = data!;
  const t = stats.totals;
  const weeks = stats.weekly ?? [];
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const first = accountName(session).split(' ')[0];
  const goal = nextMilestone(t.schools);
  const hoursSaved = Math.round((t.scripts * MINUTES_SAVED_PER_SCRIPT) / 60);
  const latest = Math.max(currentBuild(), ...stats.builds.map((b) => b.build), 0);
  const onOld = stats.builds.filter((b) => b.build < latest).reduce((n, b) => n + b.users, 0);
  const buildUsers = stats.builds.reduce((n, b) => n + b.users, 0);
  const live = announcements.find((a) => !a.stopped_at && (!a.ends_at || new Date(a.ends_at) > new Date()));
  const shown = query.trim() ? schools.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())) : schools;

  return (
    <PhotoScreen
      photo={PHOTOS.start}
      height={240}
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.accent }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Zelvo owner</Text>
            </View>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={{ fontSize: 15, color: '#E4E2FF', fontWeight: '500' }}>
            {greeting()}
            {first ? `, ${first}` : ''}
          </Text>
          <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 }}>
            {t.schools === 0
              ? 'Your first school is on its way.'
              : `Zelvo is helping ${plural(t.schools, 'school', 'schools')}${t.scripts > 0 ? ` and has marked ${plural(t.scripts, 'script', 'scripts')}.` : '.'}`}
          </Text>
        </View>
      }
    >
      {/* Milestone: something to look forward to. */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="trophy-outline" size={22} color={colors.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Next milestone: {plural(goal.next, 'school', 'schools')}</Text>
            <Text style={styles.cardText}>
              {goal.next - t.schools === 1 ? 'Just one more to go.' : `${(goal.next - t.schools).toLocaleString()} more to go. You've got this.`}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: space.md }}>
          <ProgressBar progress={goal.progress} />
        </View>
      </View>

      {/* This week, framed kindly: growth in green, a quiet week in grey, never red. */}
      <SectionTitle>This week</SectionTitle>
      <View style={styles.grid}>
        <Tile icon="person-add-outline" tint="primary" value={thisWeek?.accounts ?? 0} label="new accounts" before={lastWeek?.accounts} />
        <Tile icon="pulse-outline" tint="success" value={stats.active.week} label="people used Zelvo" before={lastWeek?.active} />
        <Tile icon="scan-outline" tint="accent" value={thisWeek?.scripts ?? 0} label="scripts marked" before={lastWeek?.scripts} />
        <Tile icon="document-text-outline" tint="info" value={thisWeek?.exams ?? 0} label="exams created" before={lastWeek?.exams} />
      </View>
      <Text style={styles.foot}>
        {stats.active.today} active today · {stats.active.month} in the last 30 days
      </Text>

      {hoursSaved > 0 ? (
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.successSoft, borderColor: '#C6E9D5' }]}>
          <Ionicons name="time-outline" size={26} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: '#0F5C33' }]}>About {plural(hoursSaved, 'hour', 'hours')} of marking saved</Text>
            <Text style={[styles.cardText, { color: '#24553A' }]}>Teachers&apos; time given back, counting {MINUTES_SAVED_PER_SCRIPT} minutes a script.</Text>
          </View>
        </View>
      ) : null}

      <SectionTitle>Growth</SectionTitle>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
          {METRICS.map((m) => (
            <Chip key={m.key} label={m.label} selected={metric.key === m.key} onPress={() => setMetric(m)} />
          ))}
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>
          {weeks.reduce((n, w) => n + w[metric.key], 0).toLocaleString()}
        </Text>
        <Text style={[styles.cardText, { marginBottom: space.md }]}>{metric.label.toLowerCase()} in the last 12 weeks</Text>
        <BarChart
          values={weeks.map((w) => w[metric.key])}
          labels={[weeks[0] ? new Date(weeks[0].week).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '', 'This week']}
        />
      </View>

      <SectionTitle>Everything so far</SectionTitle>
      <View style={styles.grid}>
        <Total icon="business-outline" value={t.schools} label="Schools" />
        <Total icon="people-outline" value={t.accounts} label="Accounts" />
        <Total icon="id-card-outline" value={t.staff} label="Staff" />
        <Total icon="school-outline" value={t.student_accounts} label="Students on Zelvo" />
        <Total icon="document-text-outline" value={t.exams} label="Exams" />
        <Total icon="calendar-outline" value={t.lessons} label="Lessons on timetables" />
      </View>

      <SectionTitle>App versions</SectionTitle>
      <View style={styles.card}>
        {stats.builds.length === 0 ? (
          <Text style={styles.cardText}>Versions appear here as people open the new app.</Text>
        ) : (
          <>
            {stats.builds.map((b) => (
              <View key={b.build} style={{ marginBottom: space.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    Build {b.build} {b.build === latest ? '· newest' : ''}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.muted }}>{plural(b.users, 'person', 'people')}</Text>
                </View>
                <ProgressBar progress={b.users / Math.max(1, buildUsers)} color={b.build === latest ? colors.success : colors.primary} />
              </View>
            ))}
            <Text style={styles.cardText}>
              {onOld === 0 ? 'Everyone is up to date.' : `${plural(onOld, 'person is', 'people are')} on an older build.`}
            </Text>
            {onOld > 0 ? (
              <Button small variant="secondary" icon="megaphone-outline" title="Remind them to update" onPress={() => router.push('/owner/announcements')} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
            ) : null}
          </>
        )}
      </View>

      <SectionTitle>Announcement</SectionTitle>
      <Pressable onPress={() => router.push('/owner/announcements')} accessibilityRole="button" style={({ pressed }) => [styles.card, { flexDirection: 'row', alignItems: 'center', gap: space.md }, pressed && { opacity: 0.85 }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{live ? live.title : 'Nothing showing right now'}</Text>
          <Text style={styles.cardText}>{live ? 'Showing on everyone’s Home screen' : 'Post a message to every Zelvo user.'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>

      <SectionTitle>{`Schools (${schools.length})`}</SectionTitle>
      {schools.length > 6 ? <Input value={query} onChangeText={setQuery} placeholder="Find a school" style={{ marginBottom: space.md }} /> : null}
      {schools.length === 0 ? (
        <EmptyState icon="business-outline" photo={PHOTOS.head} title="No schools yet" text="When a principal sets up a school, it appears here. The first one is the hardest!" />
      ) : (
        shown.map((s) => (
          <Pressable
            key={s.school_id}
            onPress={() => router.push({ pathname: '/owner/school/[id]', params: { id: s.school_id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, { marginBottom: space.sm }, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
                {s.name}
              </Text>
              {s.suspended ? <Badge label="Suspended" tone="warning" /> : null}
            </View>
            <Text style={styles.cardText}>{[s.country, sinceText(s.last_active)].filter(Boolean).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
              <Mini icon="id-card-outline" text={`${s.staff_joined} staff`} />
              <Mini icon="school-outline" text={`${s.student_accounts} students`} />
              <Mini icon="document-text-outline" text={`${s.exams} exams`} />
              <Mini icon="scan-outline" text={`${s.scripts} scripts`} />
            </View>
          </Pressable>
        ))
      )}

      <Text style={[styles.foot, { textAlign: 'center', marginTop: space.lg }]}>
        Counts only. Scores, answers and student names stay private to each school.
      </Text>
    </PhotoScreen>
  );
}

const TINTS = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  accent: { bg: colors.accentSoft, fg: colors.accentText },
  success: { bg: colors.successSoft, fg: colors.success },
  info: { bg: colors.infoSoft, fg: colors.info },
};

function Tile({ icon, tint, value, label, before }: { icon: IconName; tint: keyof typeof TINTS; value: number; label: string; before?: number }) {
  const t = TINTS[tint];
  const up = before !== undefined && value > before;
  return (
    <View style={styles.tile}>
      <View style={[styles.icon, { backgroundColor: t.bg, width: 34, height: 34, borderRadius: 11 }]}>
        <Ionicons name={icon} size={18} color={t.fg} />
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, marginTop: space.sm }}>{value.toLocaleString()}</Text>
      <Text style={styles.cardText}>{label}</Text>
      {up ? (
        <View style={styles.up}>
          <Ionicons name="trending-up" size={13} color={colors.success} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>More than last week</Text>
        </View>
      ) : null}
    </View>
  );
}

function Total({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={[styles.tile, { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{value.toLocaleString()}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      </View>
    </View>
  );
}

function Mini({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={{ fontSize: 13, color: colors.muted }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardText: { fontSize: 13, lineHeight: 18, color: colors.muted },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  up: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  foot: { fontSize: 12, color: colors.muted },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
