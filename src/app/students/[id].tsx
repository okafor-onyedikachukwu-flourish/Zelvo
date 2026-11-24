import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Banner, Button, Card, ErrorView, Field, Input, LoadingView, Screen, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { copyCode, emailStudentInvite, formatCode, looksLikeEmail, shareStudentInvite } from '../../lib/invites';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(id: string) {
  const student = must(await supabase.from('students').select('id, full_name, class_id').eq('id', id).single());
  const [cls, account, invite] = await Promise.all([
    supabase.from('classes').select('name').eq('id', student.class_id).single().then(must),
    supabase.from('student_accounts').select('decided_at').eq('student_id', id).eq('status', 'approved').maybeSingle().then(must),
    supabase.from('student_invites').select('code, email').eq('student_id', id).maybeSingle().then(must),
  ]);
  return { ...student, className: cls.name, joined: account !== null, joinedAt: account?.decided_at ?? null, invite };
}

type Student = Awaited<ReturnType<typeof load>>;

export default function StudentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id), id);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const student = data!;
  // Remount when the stored code or email changes, so the email box starts from what's saved.
  return <StudentForm key={`${student.joined}|${student.invite?.code}|${student.invite?.email}`} student={student} reload={reload} />;
}

function StudentForm({ student, reload }: { student: Student; reload: () => Promise<void> }) {
  const { school } = useCurrentSchool();
  const invite = student.invite;
  const [email, setEmail] = useState(invite?.email ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const typed = email.trim().toLowerCase();
  const emailChanged = invite !== null && typed !== invite.email;

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

  /** Saves the email (and a new code if asked), then opens the email app with the code ready. */
  const send = (fresh: boolean) =>
    run(fresh ? 'new' : 'send', async () => {
      if (!looksLikeEmail(typed)) throw new Error("Enter the student's email, e.g. name@gmail.com.");
      if (fresh && !(await confirm('Make a new code?', 'The old code will stop working.', 'New code'))) return;
      const code = must(await supabase.rpc('send_student_code', { p_student: student.id, p_email: typed, p_new: fresh }));
      try {
        await emailStudentInvite(typed, student.full_name, school.name, student.className, code);
      } finally {
        await reload();
      }
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: student.full_name }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <Card style={{ gap: 4, marginBottom: space.lg }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{student.full_name}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>{student.className}</Text>
      </Card>

      {student.joined ? (
        <Banner
          tone="success"
          icon="checkmark-circle"
          title="Joined Zelvo"
          text={
            (student.joinedAt ? `Joined on ${new Date(student.joinedAt).toLocaleDateString()}. ` : '') +
            'They see an exam’s results once "Students can see results" is turned on for it.'
          }
        />
      ) : (
        <>
          {invite ? (
            <Card style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Their code (not used yet)</Text>
              <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: 4, color: colors.text }}>{formatCode(invite.code)}</Text>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
                Sent to {invite.email}. It only works for an account made with that email.
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  small
                  variant="secondary"
                  icon="share-social-outline"
                  title="Share"
                  onPress={() => shareStudentInvite(student.full_name, school.name, student.className, invite.code, invite.email)}
                />
                <Button small variant="secondary" icon="copy-outline" title="Copy" onPress={() => copyCode(invite.code)} />
                <Button small variant="secondary" icon="refresh" title="New code" onPress={() => send(true)} loading={busy === 'new'} />
              </View>
            </Card>
          ) : null}

          <Field
            label="Student's email (e.g. Gmail)"
            hint="Zelvo opens your email app with their own code ready to send. The code only works for an account made with this email, and it joins them straight away."
          >
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="name@gmail.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>
          <Button
            icon="mail-outline"
            title={!invite ? 'Send code to their email' : emailChanged ? 'Send to this email instead' : 'Send code again'}
            onPress={() => send(false)}
            loading={busy === 'send'}
            disabled={!typed}
          />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.md }}>
            Students without a code can still ask to join from the app. Their requests appear under School → Student accounts.
          </Text>
        </>
      )}
    </Screen>
  );
}
