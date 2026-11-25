import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../components/theme';
import { EmptyState, ErrorView, LoadingView, Screen } from '../../components/ui';
import { isoDate } from '../../lib/alarms';
import { dateLabel, durationText } from '../../lib/examTimetable';
import { PHOTOS } from '../../lib/photos';
import { useSchool } from '../../lib/school';
import { loadMyExams } from '../../lib/studentResults';
import { formatTime } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

/** A student's exam timetable: every paper their class writes, day by day. */
export default function StudentExams() {
  const { studentAccounts } = useSchool();
  const me = studentAccounts.find((a) => a.status === 'approved') ?? studentAccounts[0];
  const { data, loading, error, reload, refresh, refreshing } = useLoad(loadMyExams, me?.id ?? '');
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const t = isoDate(new Date());
  const papers = (data ?? []).filter((p) => !me || p.class_id === me.classId);
  const coming = papers.filter((p) => p.day >= t);
  if (coming.length === 0) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <EmptyState icon="document-text-outline" photo={PHOTOS.writing} title="No exams coming up" text="When your school adds the exam timetable, your papers show here." />
      </Screen>
    );
  }
  const days = [...new Set(coming.map((p) => p.day))];
  const periods = [...new Set(coming.map((p) => p.period_name))];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.heading}>{periods.join(' · ')}</Text>
      <Text style={styles.muted}>
        {coming.length} {coming.length === 1 ? 'paper' : 'papers'} for {me?.className}. Good luck!
      </Text>
      {days.map((day) => (
        <View key={day} style={{ marginTop: space.lg }}>
          <Text style={[styles.day, day === t && { color: colors.accentText }]}>
            {day === t ? 'Today · ' : ''}
            {dateLabel(day, true)}
          </Text>
          {coming
            .filter((p) => p.day === day)
            .map((p, i) => (
              <View key={`${p.starts_at}-${i}`} style={styles.paper}>
                <View style={{ width: 70 }}>
                  <Text style={styles.start}>{formatTime(p.starts_at)}</Text>
                  <Text style={styles.small}>{durationText(p.starts_at, p.ends_at)}</Text>
                </View>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.subject}>{p.subject}</Text>
                  <Text style={styles.small}>{[p.paper, p.room, `ends ${formatTime(p.ends_at)}`].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 19, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
  day: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: space.sm },
  paper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  start: { fontSize: 15, fontWeight: '800', color: colors.primary },
  subject: { fontSize: 16, fontWeight: '700', color: colors.text },
  small: { fontSize: 12.5, color: colors.muted },
});
