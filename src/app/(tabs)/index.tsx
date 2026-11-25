import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../components/BarChart';
import { PhotoScreen, useLightStatusBar } from '../../components/Photo';
import { colors, radius, space } from '../../components/theme';
import { AnnouncementBanner } from '../../components/AnnouncementBanner';
import { UpdateBanner } from '../../components/UpdateBanner';
import { Button, ErrorView, Group, ListRow, LoadingView, SectionTitle, type IconName } from '../../components/ui';
import { checkReadiness, getAlarmSettings, isoDate, leadLabel } from '../../lib/alarms';
import { dateLabel, periodStatus, rangeLabel, type ExamPeriod } from '../../lib/examTimetable';
import { PHOTOS } from '../../lib/photos';
import { roleLabel, useCurrentSchool } from '../../lib/school';
import { formatDate } from '../../lib/sheet/render';
import { formatTime, loadTimetable, nextLesson, whenText } from '../../lib/timetable';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

type Counts = { classes: number; subjects: number; students: number; staff: number; requests: number; staffRequests: number };

async function load(schoolId: string, isAdmin: boolean, staffId: string) {
  const count = async (table: 'classes' | 'subjects' | 'students') => {
    const res = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
    if (res.error) throw res.error;
    return res.count ?? 0;
  };
  const pending = async (table: 'student_accounts' | 'staff_requests') => {
    const res = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending');
    if (res.error) throw res.error;
    return res.count ?? 0;
  };
  const todayIso = isoDate(new Date());
  const [classes, subjects, students, staff, requests, staffRequests, recent, tt, examPeriods, alarm, readiness] = await Promise.all([
    count('classes'),
    count('subjects'),
    count('students'),
    supabase.from('staff').select('user_id').eq('school_id', schoolId).not('user_id', 'is', null).then(must),
    pending('student_accounts'),
    isAdmin ? pending('staff_requests') : Promise.resolve(0),
    supabase
      .from('exams')
      .select('id, title, exam_date, classes(name), subjects(name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(must),
    loadTimetable(schoolId),
    supabase
      .from('exam_periods')
      .select('id, name, starts_on, ends_on, lessons_stop')
      .eq('school_id', schoolId)
      .gte('ends_on', todayIso)
      .order('starts_on')
      .limit(1)
      .then(must),
    getAlarmSettings(),
    Platform.OS === 'android' ? checkReadiness().catch(() => null) : Promise.resolve(null),
  ]);
  const counts: Counts = { classes, subjects, students, staff: staff.length, requests, staffRequests };
  // My next lesson, for the timetable card.
  const mine = tt.lessons
    .filter((l) => l.teacher_id === staffId)
    .map((l) => {
      const p = tt.periods.find((x) => x.id === l.period_id)!;
      return {
        day: l.day,
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        what: `${tt.subjects.find((x) => x.id === l.subject_id)?.name ?? ''} · ${tt.classes.find((x) => x.id === l.class_id)?.name ?? ''}`,
        room: l.room,
      };
    });
  const next = nextLesson(mine, tt.days);

  // The next (or current) exams, and the papers I invigilate in them.
  const exam = (examPeriods[0] as ExamPeriod | undefined) ?? null;
  const nowHm = new Date().toTimeString().slice(0, 5);
  const myPapers = exam
    ? (
        await supabase
          .from('exam_papers')
          .select('day, starts_at, subject_id, room')
          .eq('exam_period_id', exam.id)
          .eq('invigilator_id', staffId)
          .gte('day', todayIso)
          .order('day')
          .order('starts_at')
          .then(must)
      ).filter((p) => p.day > todayIso || p.starts_at.slice(0, 5) >= nowHm)
    : [];
  const sittings = [...new Map(myPapers.map((p) => [`${p.day}|${p.starts_at}|${p.room ?? ''}`, p])).values()];
  const nextPaper = sittings[0]
    ? { ...sittings[0], subject: tt.subjects.find((x) => x.id === sittings[0].subject_id)?.name ?? 'Exam' }
    : null;
  const hasAlarms = mine.length > 0 || sittings.length > 0;
  return {
    counts,
    recent,
    next,
    hasBells: tt.periods.length > 0,
    lessonCount: tt.lessons.length,
    exam,
    invigilating: sittings.length,
    nextPaper,
    alarm,
    needsAlarmPermission: hasAlarms && !!readiness && !readiness.notifications,
  };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { school, schoolId, staffId, fullName, role, headTitle, isAdmin, isHod } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId, isAdmin, staffId), `${schoolId}:${isAdmin}:${staffId}`);
  useLightStatusBar();

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { counts: c, recent, next, hasBells, lessonCount, exam, invigilating, nextPaper, alarm, needsAlarmPermission } = data!;
  const alarmNote = !alarm.enabled ? 'Lesson alarms are off' : alarm.resumeOn ? 'Alarms paused for the holiday' : `Alarm ${leadLabel(alarm.lead).toLowerCase()}`;
  const examStatus = exam ? periodStatus(exam) : null;
  const examText = exam
    ? nextPaper
      ? `You invigilate ${invigilating} ${invigilating === 1 ? 'paper' : 'papers'}. Next: ${dateLabel(nextPaper.day)}, ${formatTime(nextPaper.starts_at)} ${nextPaper.subject}`
      : `${rangeLabel(exam.starts_on, exam.ends_on)}${exam.lessons_stop ? ' · Lesson alarms pause' : ''}`
    : 'Plan the next exams: dates, papers and invigilators.';
  const lessonTitle = next
    ? `${formatTime(next.lesson.starts_at)} · ${next.lesson.what}`
    : isAdmin && !hasBells
      ? 'Set up the timetable'
      : 'School timetable';
  const lessonText = next
    ? [next.isNow ? 'Happening now' : whenText(next.inMinutes, next.lesson.day), next.lesson.room].filter(Boolean).join(' · ')
    : isAdmin && !hasBells
      ? 'Start with the bell times, then add the lessons or upload a spreadsheet.'
      : lessonCount > 0
        ? 'See every class and teacher.'
        : "The timetable hasn't been filled in yet.";

  const actions: { icon: IconName; label: string; bg: string; fg: string; href: Href }[] = [
    { icon: 'add', label: 'New exam', bg: colors.primarySoft, fg: colors.primary, href: '/exams/new' },
    { icon: 'scan-outline', label: 'Scan scripts', bg: colors.accentSoft, fg: colors.accentText, href: '/exams' },
    {
      icon: 'bar-chart-outline',
      label: isAdmin ? 'School results' : isHod ? 'Department results' : 'My results',
      bg: colors.successSoft,
      fg: colors.success,
      href: '/performance',
    },
    isAdmin
      ? { icon: 'people-outline', label: 'Staff', bg: colors.infoSoft, fg: colors.info, href: '/staff' }
      : { icon: 'grid-outline', label: 'Classes', bg: colors.infoSoft, fg: colors.info, href: '/classes' },
  ];

  return (
    <>
      <PhotoScreen
        photo={PHOTOS.classroom}
        refreshing={refreshing}
        onRefresh={refresh}
        header={
          <View style={{ gap: space.md }}>
            <View style={{ alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.accent }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{roleLabel(role, null, headTitle)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 15, color: '#E4E2FF', fontWeight: '500' }}>
                {greeting()}, {fullName.split(' ')[0]}
              </Text>
              <Text style={{ fontSize: 25, lineHeight: 31, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 }} numberOfLines={2}>
                {school.name}
              </Text>
            </View>
          </View>
        }
      >
        <UpdateBanner />
        <AnnouncementBanner />

        {c.staffRequests > 0 ? (
          <Nudge
            icon="person-add-outline"
            text={`${c.staffRequests} ${c.staffRequests === 1 ? 'person is' : 'people are'} asking to join your staff`}
            onPress={() => router.push('/staff')}
          />
        ) : null}
        {needsAlarmPermission ? (
          <Nudge icon="alarm-outline" text="Allow Zelvo to ring before your lessons" button="Turn on" onPress={() => router.push('/alarms')} />
        ) : null}
        {c.requests > 0 ? (
          <Nudge
            icon="school-outline"
            text={`${c.requests} ${c.requests === 1 ? 'student is' : 'students are'} waiting for you to confirm them`}
            onPress={() => router.push('/student-requests')}
          />
        ) : null}

        <View style={styles.grid}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.tileIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={19} color={a.fg} />
              </View>
              <Text style={styles.tileLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => router.push(isAdmin && !hasBells ? '/timetable/bells' : '/timetable')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.lesson, pressed && { opacity: 0.85 }]}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={next ? 'alarm-outline' : 'calendar-outline'} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.4 }}>{next ? 'NEXT LESSON' : 'TIMETABLE'}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{lessonTitle}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{lessonText}</Text>
            {next && Platform.OS === 'android' ? (
              <Pressable onPress={() => router.push('/alarms')} hitSlop={8} accessibilityRole="button" style={styles.alarmNote}>
                <Ionicons name={alarm.enabled && !alarm.resumeOn ? 'notifications' : 'notifications-off-outline'} size={13} color={colors.primary} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.primary }}>{alarmNote}</Text>
              </Pressable>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        {exam || isAdmin ? (
          <Pressable
            onPress={() => router.push(exam ? { pathname: '/exam-timetable/[id]', params: { id: exam.id } } : '/exam-timetable')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.lesson, pressed && { opacity: 0.85 }]}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text-outline" size={22} color={colors.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.4 }}>
                {exam ? `EXAMS · ${examStatus!.label.toUpperCase()}` : 'EXAM TIMETABLE'}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{exam ? exam.name : 'No exams planned yet'}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{examText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ) : null}

        {recent.length > 0 ? (
          <>
            <SectionTitle>Recent exams</SectionTitle>
            <Group>
              {recent.map((e) => (
                <ListRow
                  key={e.id}
                  icon="document-text-outline"
                  title={e.title}
                  subtitle={[e.classes?.name, e.subjects?.name, formatDate(e.exam_date)].filter(Boolean).join(' · ')}
                  onPress={() => router.push({ pathname: '/exams/[id]', params: { id: e.id } })}
                />
              ))}
            </Group>
          </>
        ) : null}

        {isAdmin ? (
          <>
            <SectionTitle>Set up your school</SectionTitle>
            <SetupProgress done={[c.classes > 0, c.subjects > 0, c.staff > 1, hasBells, lessonCount > 0].filter(Boolean).length} of={5} />
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
              <Step done={hasBells} title="Set the bell times" detail="When each period starts and ends." href="/timetable/bells" />
              <Step
                done={lessonCount > 0}
                title="Fill in the timetable"
                detail={lessonCount > 0 ? `${plural(lessonCount, 'lesson', 'lessons')} a week` : 'Tap it in, or upload a spreadsheet.'}
                href="/timetable"
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
              <ListRow icon="document-text-outline" title="Exam timetable" subtitle="Exam dates and who invigilates" onPress={() => router.push('/exam-timetable')} />
            </Group>
          </>
        )}
      </PhotoScreen>
    </>
  );
}

/** "3 of 5 done", with a bar and a kind word. */
function SetupProgress({ done, of }: { done: number; of: number }) {
  const text = done === of ? 'All set up. Well done!' : done === 0 ? "Let's get started." : done >= of - 1 ? 'Nearly there!' : 'Good progress.';
  return (
    <View style={{ marginBottom: space.md, gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
        {done} of {of} done · {text}
      </Text>
      <ProgressBar progress={done / of} color={colors.success} />
    </View>
  );
}

/** An orange "needs your attention" card with a Review button. */
function Nudge({ icon, text, onPress, button = 'Review' }: { icon: IconName; text: string; onPress: () => void; button?: string }) {
  return (
    <View style={styles.nudge}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={colors.accentText} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#5A2504' }}>{text}</Text>
      <Button small title={button} onPress={onPress} style={{ backgroundColor: colors.accentText, borderColor: colors.accentText }} />
    </View>
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

const styles = StyleSheet.create({
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#FFD9BF',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    height: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    justifyContent: 'space-between',
  },
  tileIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  alarmNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  lesson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
