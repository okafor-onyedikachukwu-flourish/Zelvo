import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../components/theme';
import { Badge, Button, EmptyState, ErrorView, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { isoDate } from '../../lib/alarms';
import { loadExamPeriods, periodStatus, rangeLabel } from '../../lib/examTimetable';
import { PHOTOS } from '../../lib/photos';
import { useCurrentSchool } from '../../lib/school';
import { useLoad } from '../../lib/useLoad';

/** Exam periods: what's on now, what's coming, and past ones. */
export default function ExamTimetable() {
  const { schoolId, staffId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadExamPeriods(schoolId, staffId), schoolId);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;

  const t = isoDate(new Date());
  const current = (data ?? []).filter((p) => p.ends_on >= t);
  const past = (data ?? []).filter((p) => p.ends_on < t).reverse();
  const add = () => router.push('/exam-timetable/period');

  if (!data || data.length === 0) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <EmptyState
          icon="calendar-outline"
          photo={PHOTOS.writing}
          title={isAdmin ? 'Set up the exam timetable' : 'No exams on the timetable yet'}
          text={
            isAdmin
              ? 'Add an exam period (like "First term exams"), then each paper with its date, time, classes and invigilator. Invigilators get an alarm before each paper.'
              : 'When your vice-principal adds the exams, you’ll see them here, and get an alarm before each paper you invigilate.'
          }
          action={isAdmin ? <Button title="Add an exam period" icon="add" onPress={add} /> : undefined}
        />
      </Screen>
    );
  }

  const card = (p: (typeof data)[number]) => {
    const status = periodStatus(p);
    return (
      <Pressable
        key={p.id}
        onPress={() => router.push({ pathname: '/exam-timetable/[id]', params: { id: p.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="calendar" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.cardText}>{rangeLabel(p.starts_on, p.ends_on)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            <Badge label={status.label} tone={status.tone} />
            <Badge label={`${p.papers} ${p.papers === 1 ? 'paper' : 'papers'}`} />
            {p.mine > 0 ? <Badge label={`You invigilate ${p.mine}`} tone="primary" /> : null}
            {!p.lessons_stop ? <Badge label="Lessons carry on" tone="success" /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>
    );
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {isAdmin ? <Button title="Add an exam period" icon="add" onPress={add} style={{ marginBottom: space.lg }} /> : null}
      {current.length > 0 ? (
        <>
          <SectionTitle>Now and coming up</SectionTitle>
          {current.map(card)}
        </>
      ) : null}
      {past.length > 0 ? (
        <>
          <SectionTitle>Past</SectionTitle>
          {past.map(card)}
        </>
      ) : null}
      <Text style={styles.note}>
        During an exam period, lesson alarms pause, and invigilators get an alarm before each paper they supervise.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
  },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardText: { fontSize: 14, color: colors.muted },
  note: { fontSize: 13, color: colors.muted, marginTop: space.lg, lineHeight: 19 },
});
