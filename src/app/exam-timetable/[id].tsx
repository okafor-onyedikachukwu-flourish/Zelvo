import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../components/theme';
import { Badge, Button, Card, Chip, EmptyState, ErrorView, LoadingView, Screen } from '../../components/ui';
import { isoDate } from '../../lib/alarms';
import { dateLabel, durationText, loadExamPeriod, periodStatus, rangeLabel, sittings, type Sitting } from '../../lib/examTimetable';
import { useCurrentSchool } from '../../lib/school';
import { formatTime } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

/** One exam period: its papers day by day. Heads add and change papers; everyone else can look. */
export default function ExamPeriodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schoolId, staffId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadExamPeriod(schoolId, id), `${schoolId}:${id}`);
  const [filter, setFilter] = useState<'all' | 'mine' | string>('all');

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data?.period) {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="This exam period was removed" text="Someone deleted it from the exam timetable." action={<Button title="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const { period, classes, subjects, staff } = data;
  const all = sittings(data.papers, classes);
  const mineCount = all.filter((s) => s.invigilator_id === staffId).length;
  const shown = all.filter((s) => (filter === 'all' ? true : filter === 'mine' ? s.invigilator_id === staffId : s.classIds.includes(filter)));
  const days = [...new Set(shown.map((s) => s.day))];
  const status = periodStatus(period);
  const t = isoDate(new Date());

  const subject = (sid: string) => subjects.find((s) => s.id === sid)?.name ?? 'Subject';
  const className = (cid: string) => classes.find((c) => c.id === cid)?.name ?? '';
  const person = (pid: string | null) => (pid === staffId ? 'You' : (staff.find((s) => s.id === pid)?.name ?? ''));

  const addPaper = (day?: string) =>
    router.push({ pathname: '/exam-timetable/paper', params: { period: period.id, ...(day ? { day } : {}) } });
  const editPaper = (s: Sitting) => router.push({ pathname: '/exam-timetable/paper', params: { period: period.id, ids: s.ids.join(',') } });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: period.name }} />
      <Card style={{ gap: space.sm, marginBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{period.name}</Text>
            <Text style={styles.muted}>{rangeLabel(period.starts_on, period.ends_on)}</Text>
          </View>
          {isAdmin ? (
            <Button small variant="secondary" icon="create-outline" title="Edit" onPress={() => router.push({ pathname: '/exam-timetable/period', params: { id: period.id } })} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={status.label} tone={status.tone} />
          <Badge label={`${all.length} ${all.length === 1 ? 'paper' : 'papers'}`} />
        </View>
        <Text style={styles.small}>
          {period.lessons_stop
            ? 'Normal lessons stop on these days, so lesson alarms pause. Invigilators get an alarm before each paper.'
            : 'Normal lessons carry on during these exams. Invigilators also get an alarm before each paper.'}
        </Text>
      </Card>

      {isAdmin ? <Button title="Add a paper" icon="add" onPress={() => addPaper(period.starts_on >= t ? period.starts_on : undefined)} /> : null}

      {all.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.lg }} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="All papers" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {mineCount > 0 ? <Chip label={`I invigilate (${mineCount})`} selected={filter === 'mine'} onPress={() => setFilter('mine')} /> : null}
          {classes
            .filter((c) => all.some((s) => s.classIds.includes(c.id)))
            .map((c) => (
              <Chip key={c.id} label={c.name} selected={filter === c.id} onPress={() => setFilter(c.id)} />
            ))}
        </ScrollView>
      ) : (
        <Text style={[styles.muted, { marginTop: space.lg }]}>
          {isAdmin ? 'No papers yet. Add the first one.' : 'No papers on this exam timetable yet.'}
        </Text>
      )}

      {days.map((day) => (
        <View key={day} style={{ marginTop: space.lg }}>
          <View style={styles.dayRow}>
            <Text style={[styles.day, day === t && { color: colors.accentText }]}>
              {day === t ? 'Today · ' : ''}
              {dateLabel(day, true)}
            </Text>
            {isAdmin ? (
              <Pressable onPress={() => addPaper(day)} hitSlop={8} accessibilityLabel={`Add a paper on ${dateLabel(day, true)}`}>
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          {shown
            .filter((s) => s.day === day)
            .map((s) => {
              const mine = s.invigilator_id === staffId;
              return (
                <Pressable
                  key={s.key}
                  onPress={isAdmin ? () => editPaper(s) : undefined}
                  disabled={!isAdmin}
                  style={({ pressed }) => [styles.paper, mine && styles.paperMine, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.time}>
                    <Text style={styles.start}>{formatTime(s.starts_at)}</Text>
                    <Text style={styles.small}>{durationText(s.starts_at, s.ends_at)}</Text>
                  </View>
                  <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.subject}>
                      {subject(s.subject_id)}
                      {s.paper ? <Text style={styles.paperLabel}> · {s.paper}</Text> : null}
                    </Text>
                    <Text style={styles.muted} numberOfLines={2}>
                      {s.classIds.map(className).join(', ')}
                    </Text>
                    <Text style={styles.small}>
                      {[s.room, s.invigilator_id ? `Invigilator: ${person(s.invigilator_id)}` : 'No invigilator yet', `ends ${formatTime(s.ends_at)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {isAdmin ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
                </Pressable>
              );
            })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  day: { fontSize: 15, fontWeight: '800', color: colors.text },
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
  paperMine: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  time: { width: 64, gap: 2 },
  start: { fontSize: 15, fontWeight: '800', color: colors.primary },
  subject: { fontSize: 16, fontWeight: '700', color: colors.text },
  paperLabel: { fontSize: 14, fontWeight: '600', color: colors.muted },
});
