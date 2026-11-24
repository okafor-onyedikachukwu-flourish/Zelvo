import { router } from 'expo-router';
import { Badge, Button, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { keyProgress } from '../../lib/exams';
import { useCurrentSchool } from '../../lib/school';
import { formatDate } from '../../lib/sheet/render';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(schoolId: string, isAdmin: boolean, isHod = false) {
  const [exams, staff] = await Promise.all([
    supabase
      .from('exams')
      .select('id, title, exam_date, question_count, answer_key, created_by, created_at, classes(name), subjects(name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .then(must),
    isAdmin || isHod
      ? supabase.from('staff').select('user_id, full_name').eq('school_id', schoolId).then(must)
      : Promise.resolve([] as { user_id: string | null; full_name: string }[]),
  ]);
  const names = new Map(staff.filter((s) => s.user_id).map((s) => [s.user_id!, s.full_name]));
  return exams.map((e) => ({ ...e, creator: e.created_by ? (names.get(e.created_by) ?? null) : null }));
}

export default function Exams() {
  const { session } = useAuth();
  const { schoolId, isAdmin, isHod } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId, isAdmin, isHod), `${schoolId}:${isAdmin}:${isHod}`);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const exams = data ?? [];
  const mine = exams.filter((e) => e.created_by === session?.user.id);
  const others = exams.filter((e) => e.created_by !== session?.user.id);

  const row = (e: (typeof exams)[number], showCreator: boolean) => {
    const { set, total } = keyProgress(e.answer_key);
    const parts = [e.classes?.name, e.subjects?.name, formatDate(e.exam_date)].filter(Boolean);
    if (showCreator) parts.push(e.creator ? `by ${e.creator}` : 'by a former staff member');
    return (
      <ListRow
        key={e.id}
        icon="document-text-outline"
        title={e.title}
        subtitle={parts.join(' · ')}
        right={<Badge label={set === total ? 'Key ready' : `Key ${set}/${total}`} tone={set === total ? 'success' : 'warning'} />}
        onPress={() => router.push({ pathname: '/exams/[id]', params: { id: e.id } })}
      />
    );
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {exams.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No exams yet"
          text="Create an exam, enter its answer key, then print answer sheets for your students."
          action={<Button title="New exam" icon="add" onPress={() => router.push('/exams/new')} />}
        />
      ) : (
        <>
          <SectionTitle>{others.length > 0 ? 'Your exams' : `${exams.length} ${exams.length === 1 ? 'exam' : 'exams'}`}</SectionTitle>
          {mine.length > 0 ? (
            <Group>{mine.map((e) => row(e, false))}</Group>
          ) : (
            <Button variant="secondary" icon="add" title="Create your first exam" onPress={() => router.push('/exams/new')} />
          )}
          {others.length > 0 ? (
            <>
              <SectionTitle>{isAdmin ? "Other teachers' exams" : isHod ? "Your department's exams (view only)" : 'Other exams'}</SectionTitle>
              <Group>{others.map((e) => row(e, true))}</Group>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
