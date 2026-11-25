import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../components/theme';
import { EmptyState, ErrorView, LoadingView, Screen } from '../../components/ui';
import { PHOTOS } from '../../lib/photos';
import { loadMyTimetable } from '../../lib/studentResults';
import { dayShort, formatTime, today } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

/** A student's class timetable for the week. */
export default function StudentTimetable() {
  const { data, loading, error, reload, refresh, refreshing } = useLoad(loadMyTimetable, 'mine');
  const d0 = today();
  const [picked, setPicked] = useState<number | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const lessons = data ?? [];
  if (lessons.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="calendar-outline"
          photo={PHOTOS.classroom}
          title="No timetable yet"
          text="Your class timetable appears here once your school adds it."
        />
      </Screen>
    );
  }
  const days = [...new Set(lessons.map((l) => l.day))].sort((a, b) => a - b);
  const day = picked ?? (days.includes(d0) ? d0 : days[0]);
  const todays = lessons.filter((l) => l.day === day).sort((a, b) => a.period_no - b.period_no);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.days}>
        {days.map((d) => (
          <Pressable key={d} onPress={() => setPicked(d)} accessibilityRole="button" style={[styles.day, d === day && styles.daySelected]}>
            <Text style={[styles.dayText, d === day && { color: '#FFFFFF' }]}>{dayShort(d)}</Text>
            {d === d0 ? <View style={[styles.dot, d === day && { backgroundColor: '#FFFFFF' }]} /> : null}
          </Pressable>
        ))}
      </View>
      {todays.map((l) => (
        <View key={`${l.day}-${l.period_no}`} style={styles.slot}>
          <View style={{ width: 64 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{formatTime(l.starts_at)}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{formatTime(l.ends_at)}</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{l.subject}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{[l.teacher, l.room].filter(Boolean).join(' · ') || l.label}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: 6, marginBottom: space.lg },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
