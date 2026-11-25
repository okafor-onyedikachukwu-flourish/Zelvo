import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../components/theme';
import { Button, Chip, EmptyState, ErrorView, LoadingView, Screen } from '../../components/ui';
import { PHOTOS } from '../../lib/photos';
import { useCurrentSchool } from '../../lib/school';
import { dayShort, formatTime, loadTimetable, today, type Lesson, type TimetableData } from '../../lib/timetable';
import { useLoad } from '../../lib/useLoad';

type Mode = 'mine' | 'class' | 'teacher';

export default function Timetable() {
  const { schoolId } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => loadTimetable(schoolId), schoolId);
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <TimetableView data={data!} refresh={refresh} refreshing={refreshing} />;
}

function TimetableView({ data, refresh, refreshing }: { data: TimetableData; refresh: () => void; refreshing: boolean }) {
  const { isAdmin, staffId } = useCurrentSchool();
  const iTeach = data.lessons.some((l) => l.teacher_id === staffId);
  const [mode, setMode] = useState<Mode>(iTeach && !isAdmin ? 'mine' : 'class');
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id ?? '');
  const d0 = today();
  const [day, setDay] = useState(data.days.includes(d0) ? d0 : data.days[0]);

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name ?? '';
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name ?? '';
  const teacherName = (id: string | null) => (id ? data.teachers.find((t) => t.id === id)?.name ?? '' : '');

  if (data.periods.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="time-outline"
          photo={PHOTOS.classroom}
          title={isAdmin ? 'Start with the bell times' : "The timetable isn't ready yet"}
          text={
            isAdmin
              ? 'Set when each period starts and ends, then add the lessons, or upload a spreadsheet.'
              : 'Your vice-principal academic is setting it up. It will appear here.'
          }
          action={isAdmin ? <Button title="Set the bell times" icon="time-outline" onPress={() => router.push('/timetable/bells')} /> : undefined}
        />
      </Screen>
    );
  }

  const who = mode === 'class' ? classId : mode === 'teacher' ? teacherId : staffId;
  const match = (l: Lesson) => l.day === day && (mode === 'class' ? l.class_id === who : l.teacher_id === who);
  const dayLessons = data.lessons.filter(match);
  const weekCount = data.lessons.filter((l) => (mode === 'class' ? l.class_id === who : l.teacher_id === who)).length;

  const openSlot = (periodId: string, lesson?: Lesson) => {
    if (!isAdmin) return undefined;
    const cls = lesson ? lesson.class_id : mode === 'class' ? classId : null;
    if (!cls) return undefined;
    return () => router.push({ pathname: '/timetable/lesson', params: { classId: cls, day: String(day), periodId } });
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {isAdmin ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          <Button small variant="secondary" icon="time-outline" title="Bell times" onPress={() => router.push('/timetable/bells')} style={{ flex: 1 }} />
          <Button small variant="secondary" icon="cloud-upload-outline" title="Spreadsheet" onPress={() => router.push('/timetable/upload')} style={{ flex: 1 }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {iTeach || !isAdmin ? <Chip label="My lessons" selected={mode === 'mine'} onPress={() => setMode('mine')} /> : null}
        <Chip label="By class" selected={mode === 'class'} onPress={() => setMode('class')} />
        <Chip label="By teacher" selected={mode === 'teacher'} onPress={() => setMode('teacher')} />
      </View>

      {mode !== 'mine' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.md }} contentContainerStyle={{ gap: space.sm }}>
          {(mode === 'class' ? data.classes : data.teachers).map((x) => (
            <Chip
              key={x.id}
              label={x.name}
              selected={x.id === (mode === 'class' ? classId : teacherId)}
              onPress={() => (mode === 'class' ? setClassId(x.id) : setTeacherId(x.id))}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.days}>
        {data.days.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDay(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: d === day }}
            style={[styles.day, d === day && styles.daySelected]}
          >
            <Text style={[styles.dayText, d === day && { color: '#FFFFFF' }]}>{dayShort(d)}</Text>
            {d === d0 ? <View style={[styles.dot, d === day && { backgroundColor: '#FFFFFF' }]} /> : null}
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.sm }}>
        {weekCount} {weekCount === 1 ? 'lesson' : 'lessons'} a week
        {mode === 'class' ? ` for ${className(classId)}` : mode === 'teacher' ? ` for ${teacherName(teacherId)}` : ''}
      </Text>

      {data.periods.map((p) => {
        if (p.is_break) {
          return (
            <View key={p.id} style={styles.break}>
              <Ionicons name="cafe-outline" size={16} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>
                {p.label} · {formatTime(p.starts_at)} – {formatTime(p.ends_at)}
              </Text>
            </View>
          );
        }
        const lesson = dayLessons.find((l) => l.period_id === p.id);
        const onPress = openSlot(p.id, lesson);
        return (
          <Pressable
            key={p.id}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            style={({ pressed }) => [styles.slot, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.time}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{formatTime(p.starts_at)}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{formatTime(p.ends_at)}</Text>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
            {lesson ? (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                  {mode === 'class' ? subjectName(lesson.subject_id) : `${className(lesson.class_id)} · ${subjectName(lesson.subject_id)}`}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {[mode === 'class' ? teacherName(lesson.teacher_id) || 'No teacher yet' : null, lesson.room].filter(Boolean).join(' · ') ||
                    p.label}
                </Text>
              </View>
            ) : (
              <Text style={{ flex: 1, fontSize: 15, color: onPress ? colors.primary : colors.faint, fontWeight: onPress ? '600' : '400' }}>
                {onPress ? '+ Add a lesson' : 'Free'}
              </Text>
            )}
            {onPress && lesson ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: 6, marginTop: space.lg, marginBottom: space.md },
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
    minHeight: 64,
  },
  time: { width: 64 },
  break: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, paddingHorizontal: space.lg, marginBottom: space.sm },
});
