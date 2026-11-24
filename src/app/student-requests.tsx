import { useState } from 'react';
import { Text, View } from 'react-native';
import { StudentPicker } from '../components/StudentPicker';
import { colors, space } from '../components/theme';
import { Banner, Button, Card, EmptyState, ErrorView, Group, IconButton, ListRow, LoadingView, Screen, SectionTitle, confirm } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { PHOTOS } from '../lib/photos';

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

async function load(schoolId: string) {
  const [requests, students, classes] = await Promise.all([
    supabase
      .from('student_accounts')
      .select('id, typed_name, class_id, student_id, status, created_at')
      .eq('school_id', schoolId)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .then(must),
    supabase.from('students').select('id, full_name, class_id').eq('school_id', schoolId).order('full_name').then(must),
    supabase.from('classes').select('id, name').eq('school_id', schoolId).then(must),
  ]);
  return { requests, students, classNames: new Map(classes.map((c) => [c.id, c.name])) };
}

export default function StudentRequests() {
  const { schoolId, isAdmin } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId), schoolId);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { requests, students, classNames } = data!;
  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');
  const linked = new Set(approved.map((r) => r.student_id));
  const nameOf = new Map(students.map((s) => [s.id, s.full_name]));

  const bestMatch = (r: (typeof requests)[number]) =>
    (r.student_id && !linked.has(r.student_id) ? students.find((s) => s.id === r.student_id) : undefined) ??
    students.find((s) => s.class_id === r.class_id && !linked.has(s.id) && words(s.full_name) === words(r.typed_name)) ??
    students.find((s) => !linked.has(s.id) && words(s.full_name) === words(r.typed_name));

  async function decide(requestId: string, studentId: string | null, approve: boolean) {
    setBusy(requestId);
    setMessage(null);
    try {
      must(await supabase.rpc('decide_student_access', { p_request: requestId, p_student: studentId, p_approve: approve }));
      await reload();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function addAndApprove(r: (typeof requests)[number]) {
    setBusy(r.id);
    setMessage(null);
    try {
      must(await supabase.rpc('confirm_new_student', { p_request: r.id }));
      await reload();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function unlink(r: (typeof requests)[number]) {
    const who = nameOf.get(r.student_id ?? '') ?? r.typed_name;
    if (!(await confirm(`Remove ${who}'s account?`, 'They will no longer see their results. They can join again.', 'Remove'))) return;
    try {
      must(await supabase.from('student_accounts').delete().eq('id', r.id));
      await reload();
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  const pickingRequest = pending.find((r) => r.id === picking);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: space.sm }}>
        Students join from their own phones and go straight to their dashboard. Confirm each one here, matched to their
        name on the class list, and their released scores appear for them.
      </Text>

      <SectionTitle>{`Waiting for a teacher to confirm (${pending.length})`}</SectionTitle>
      {pending.length === 0 ? (
        <EmptyState photo={PHOTOS.student} icon="person-add-outline" title="Nobody waiting" text="Students who join your school appear here for you to confirm." />
      ) : (
        pending.map((r) => {
          const match = bestMatch(r);
          return (
            <Card key={r.id} style={{ marginBottom: space.sm, gap: space.sm }}>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r.typed_name}</Text>
                <Text style={{ fontSize: 14, color: colors.muted }}>Says they are in {classNames.get(r.class_id) ?? 'a class'}</Text>
                <Text style={{ fontSize: 14, color: match ? colors.success : colors.warning, marginTop: 2 }}>
                  {match ? `Matches “${match.full_name}” on the class list` : 'No exact match on the class list'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {match ? <Button small icon="checkmark" title="Confirm" onPress={() => decide(r.id, match.id, true)} loading={busy === r.id} /> : null}
                <Button small variant="secondary" icon="list-outline" title={match ? 'Different name' : 'Choose name'} onPress={() => setPicking(r.id)} />
                {!match ? (
                  <Button small variant="secondary" icon="person-add-outline" title="Add to list & confirm" onPress={() => addAndApprove(r)} loading={busy === r.id} />
                ) : null}
                <Button small variant="danger" title="Decline" onPress={() => decide(r.id, null, false)} />
              </View>
            </Card>
          );
        })
      )}

      {approved.length > 0 ? (
        <>
          <SectionTitle>{`Confirmed (${approved.length})`}</SectionTitle>
          <Group>
            {approved.map((r) => (
              <ListRow
                key={r.id}
                icon="school-outline"
                title={nameOf.get(r.student_id ?? '') ?? r.typed_name}
                subtitle={classNames.get(r.class_id)}
                right={isAdmin ? <IconButton icon="person-remove-outline" label="Remove account" onPress={() => unlink(r)} /> : undefined}
              />
            ))}
          </Group>
        </>
      ) : null}

      <StudentPicker
        visible={picking !== null}
        title={`Who is “${pickingRequest?.typed_name ?? ''}”?`}
        subtitle="Choose their name on the class list."
        students={students
          .filter((s) => !linked.has(s.id))
          .sort((a, b) => Number(b.class_id === pickingRequest?.class_id) - Number(a.class_id === pickingRequest?.class_id))
          .map((s) => ({ id: s.id, name: `${s.full_name}${s.class_id !== pickingRequest?.class_id ? ` (${classNames.get(s.class_id) ?? ''})` : ''}` }))}
        laterLabel="Cancel"
        onPick={(p) => {
          const id = picking;
          setPicking(null);
          if (id && p.studentId) decide(id, p.studentId, true);
        }}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}
