import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, ErrorView, Field, Input, LoadingView, Screen, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { copyCode, emailInvite, formatCode, looksLikeEmail, shareInvite } from '../../lib/invites';
import { RolePicker } from '../../components/RolePicker';
import type { Role } from '../../lib/school';
import { toRole, useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(id: string) {
  const person = must(await supabase.from('staff').select('id, full_name, role, subject_id, user_id, joined_at').eq('id', id).single());
  const invite = must(await supabase.from('staff_invites').select('code, email').eq('staff_id', id).maybeSingle());
  return { ...person, code: invite?.code ?? null, inviteEmail: invite?.email ?? null };
}

type Person = Awaited<ReturnType<typeof load>>;

export default function StaffMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id), id);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const person = data!;
  // Remount the form when saved values change, so it always starts from what's stored.
  return (
    <StaffForm
      key={`${person.full_name}|${person.role}|${person.subject_id}|${person.code}|${person.inviteEmail}`}
      person={person}
      reload={reload}
    />
  );
}

function StaffForm({ person, reload }: { person: Person; reload: () => Promise<void> }) {
  const { school, staffId: myStaffId, refresh: refreshSchools } = useCurrentSchool();
  const [name, setName] = useState(person.full_name);
  const [role, setRole] = useState<Role>(toRole(person.role));
  const [subjectId, setSubjectId] = useState<string | null>(person.subject_id);
  const [email, setEmail] = useState(person.inviteEmail ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const isMe = person.id === myStaffId;
  const changed = name.trim() !== person.full_name || role !== person.role || (role === 'hod' && subjectId !== person.subject_id);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      if (name.trim().length < 2) throw new Error('Enter a name.');
      if (role === 'hod' && !subjectId) throw new Error('Choose the subject this head of department is responsible for.');
      must(
        await supabase
          .from('staff')
          .update({ full_name: name.trim(), role, subject_id: role === 'hod' ? subjectId : null })
          .eq('id', person.id)
          .select('id')
          .single(),
      );
      if (isMe) await refreshSchools();
      await reload();
    });

  const saveEmail = () =>
    run('email', async () => {
      if (email.trim() && !looksLikeEmail(email)) throw new Error('Check the email address, e.g. name@gmail.com.');
      must(await supabase.rpc('set_invite_email', { p_staff_id: person.id, p_email: email.trim().toLowerCase() || null }));
      await reload();
    });

  const newCode = () =>
    run('code', async () => {
      if (!(await confirm('Make a new code?', 'The old code will stop working.', 'New code'))) return;
      must(await supabase.rpc('regenerate_invite', { p_staff_id: person.id }));
      await reload();
    });

  const remove = () =>
    run('remove', async () => {
      const text = person.user_id
        ? `${person.full_name} will lose access to ${school.name}.`
        : `${person.full_name}'s join code will stop working.`;
      if (!(await confirm(`Remove ${person.full_name}?`, text, 'Remove'))) return;
      must(await supabase.from('staff').delete().eq('id', person.id));
      router.back();
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: person.full_name }} />
      {message ? (
        <Banner tone={message.tone} icon={message.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'} title={message.text} />
      ) : null}

      {person.code ? (
        <Card style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>Join code (not joined yet)</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: 4, color: colors.text }}>{formatCode(person.code)}</Text>
          {person.inviteEmail ? (
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              Only works for an account made with {person.inviteEmail}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
            {person.inviteEmail ? (
              <Button
                small
                icon="mail-outline"
                title="Send to their email"
                onPress={() => emailInvite(person.inviteEmail!, person.full_name, school.name, person.code!)}
              />
            ) : null}
            <Button
              small
              variant={person.inviteEmail ? 'secondary' : 'primary'}
              icon="share-social-outline"
              title="Share"
              onPress={() => shareInvite(person.full_name, school.name, person.code!)}
            />
            <Button small variant="secondary" icon="copy-outline" title="Copy" onPress={() => copyCode(person.code!)} />
            <Button small variant="secondary" icon="refresh" title="New code" onPress={newCode} loading={busy === 'code'} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm }}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="Their email (e.g. Gmail)"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1 }}
            />
            <Button small variant="secondary" title="Save" onPress={saveEmail} loading={busy === 'email'} disabled={email.trim() === (person.inviteEmail ?? '')} />
          </View>
        </Card>
      ) : (
        <Banner
          tone="success"
          icon="checkmark-circle"
          title="Joined"
          text={person.joined_at ? `Joined on ${new Date(person.joined_at).toLocaleDateString()}` : undefined}
        />
      )}

      <Field label="Full name">
        <Input value={name} onChangeText={setName} />
      </Field>
      <RolePicker
        role={role}
        subjectId={subjectId}
        staffId={person.id}
        onChange={(r, sub) => {
          setRole(r);
          setSubjectId(sub);
        }}
      />
      {isMe && role !== 'admin' && person.role === 'admin' ? (
        <Text style={{ fontSize: 13, color: colors.warning, marginBottom: space.md }}>
          If you stop being head of school, you can no longer manage the school.
        </Text>
      ) : null}
      <Button title="Save changes" icon="checkmark" onPress={save} loading={busy === 'save'} disabled={!changed} />
      {!isMe ? (
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
