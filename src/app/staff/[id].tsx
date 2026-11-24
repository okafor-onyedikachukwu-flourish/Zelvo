import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { RolePicker, type Position } from '../../components/RolePicker';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, ErrorView, Field, Input, LoadingView, Screen, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { roleLabel, useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(id: string) {
  const [person, teaches] = await Promise.all([
    supabase
      .from('staff')
      .select('id, full_name, role, head_title, subject_id, user_id, joined_at, subjects!staff_subject_school_fkey(name)')
      .eq('id', id)
      .single()
      .then(must),
    supabase.from('staff_subjects').select('subjects!staff_subjects_subject_id_school_id_fkey(name)').eq('staff_id', id).then(must),
  ]);
  return { ...person, teaches: teaches.map((t) => t.subjects?.name).filter((n): n is string => !!n).sort() };
}

type Person = Awaited<ReturnType<typeof load>>;

function positionOf(p: Person): Position {
  if (p.head_title === 'vp_academic') return 'vp_academic';
  return p.role === 'hod' ? 'hod' : 'teacher';
}

export default function StaffMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id), id);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const person = data!;
  // Remount the form when saved values change, so it always starts from what's stored.
  return <StaffForm key={`${person.full_name}|${person.role}|${person.head_title}|${person.subject_id}`} person={person} reload={reload} />;
}

function StaffForm({ person, reload }: { person: Person; reload: () => Promise<void> }) {
  const { school, staffId: myStaffId, refresh: refreshSchools } = useCurrentSchool();
  const isPrincipal = person.head_title === 'principal';
  const [name, setName] = useState(person.full_name);
  const [position, setPosition] = useState<Position>(positionOf(person));
  const [subjectId, setSubjectId] = useState<string | null>(person.subject_id);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isMe = person.id === myStaffId;
  const changed =
    name.trim() !== person.full_name || position !== positionOf(person) || (position === 'hod' && subjectId !== person.subject_id);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      if (name.trim().length < 2) throw new Error('Enter a name.');
      if (position === 'hod' && !subjectId) throw new Error('Choose the department they head.');
      const fields = isPrincipal
        ? { full_name: name.trim() }
        : {
            full_name: name.trim(),
            role: position === 'vp_academic' ? 'admin' : position,
            head_title: position === 'vp_academic' ? 'vp_academic' : null,
            subject_id: position === 'hod' ? subjectId : null,
          };
      must(await supabase.from('staff').update(fields).eq('id', person.id).select('id').single());
      if (isMe) await refreshSchools();
      await reload();
    });

  const remove = () =>
    run('remove', async () => {
      if (!(await confirm(`Remove ${person.full_name}?`, `They will lose access to ${school.name}.`, 'Remove'))) return;
      must(await supabase.from('staff').delete().eq('id', person.id));
      router.back();
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: person.full_name }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card style={{ gap: 4, marginBottom: space.lg }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>
          {roleLabel(person.role, person.subjects?.name, person.head_title)}
        </Text>
        {person.teaches.length > 0 ? (
          <Text style={{ fontSize: 14, color: colors.muted }}>Teaches {person.teaches.join(', ')}</Text>
        ) : null}
        {person.joined_at ? (
          <Text style={{ fontSize: 13, color: colors.muted }}>Joined {new Date(person.joined_at).toLocaleDateString()}</Text>
        ) : null}
      </Card>

      <Field label="Name">
        <Input value={name} onChangeText={setName} />
      </Field>
      {isPrincipal ? (
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: space.lg }}>
          The principal set up this school. There is one principal per school.
        </Text>
      ) : (
        <RolePicker
          position={position}
          subjectId={subjectId}
          staffId={person.id}
          onChange={(p, sub) => {
            setPosition(p);
            setSubjectId(sub);
          }}
        />
      )}
      <Button title="Save changes" onPress={save} loading={busy === 'save'} disabled={!changed} />
      {!isPrincipal && !isMe ? (
        <Button
          variant="danger"
          icon="person-remove-outline"
          title="Remove from school"
          onPress={remove}
          loading={busy === 'remove'}
          style={{ marginTop: space.xl }}
        />
      ) : null}
    </Screen>
  );
}
