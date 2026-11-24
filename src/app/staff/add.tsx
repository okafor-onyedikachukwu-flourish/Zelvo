import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { RolePicker } from '../../components/RolePicker';
import { Banner, Button, Card, Chip, Field, Input, Screen } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { copyCode, emailInvite, formatCode, looksLikeEmail, shareInvite } from '../../lib/invites';
import { parseNames } from '../../lib/names';
import type { Role } from '../../lib/school';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

type Added = { name: string; code: string; email: string | null };

export default function AddStaff() {
  const { school, schoolId } = useCurrentSchool();
  const [mode, setMode] = useState<'one' | 'many'>('one');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [list, setList] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const [copied, setCopied] = useState(false);
  const names = mode === 'many' ? parseNames(list) : [];

  async function addOne() {
    if (name.trim().length < 2) return setError("Enter the person's full name.");
    if (role === 'hod' && !subjectId) return setError('Choose the subject this head of department is responsible for.');
    if (email.trim() && !looksLikeEmail(email)) return setError('Check the email address, e.g. name@gmail.com.');
    setBusy(true);
    setError(null);
    try {
      const row = must(
        await supabase
          .from('staff')
          .insert({ school_id: schoolId, full_name: name.trim(), role, subject_id: role === 'hod' ? subjectId : null })
          .select('id')
          .single(),
      );
      const cleanEmail = email.trim().toLowerCase() || null;
      if (cleanEmail) must(await supabase.rpc('set_invite_email', { p_staff_id: row.id, p_email: cleanEmail }));
      const invite = must(await supabase.from('staff_invites').select('code').eq('staff_id', row.id).single());
      setAdded({ name: name.trim(), code: invite.code, email: cleanEmail });
      setName('');
      setEmail('');
      setCopied(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addMany() {
    if (names.length === 0) return setError('Paste at least one name.');
    setBusy(true);
    setError(null);
    try {
      must(await supabase.from('staff').insert(names.map((n) => ({ school_id: schoolId, full_name: n, role: 'teacher' }))));
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  if (added) {
    return (
      <Screen>
        <Banner tone="success" icon="checkmark-circle" title={`${added.name} has been added`} />
        <Card style={{ alignItems: 'center', gap: space.sm }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>Their join code</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.text }}>{formatCode(added.code)}</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
            {added.email
              ? `It only works for an account made with ${added.email}. Send it to that email.`
              : 'Send it to them. They enter it in Zelvo after creating their account.'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.sm }}>
            {added.email ? (
              <Button
                small
                icon="mail-outline"
                title="Send to their email"
                onPress={() => emailInvite(added.email!, added.name, school.name, added.code)}
              />
            ) : null}
            <Button
              small
              variant={added.email ? 'secondary' : 'primary'}
              icon="share-social-outline"
              title="Share"
              onPress={() => shareInvite(added.name, school.name, added.code)}
            />
            <Button
              small
              variant="secondary"
              icon={copied ? 'checkmark' : 'copy-outline'}
              title={copied ? 'Copied' : 'Copy code'}
              onPress={async () => {
                await copyCode(added.code);
                setCopied(true);
              }}
            />
          </View>
        </Card>
        <Button title="Add another person" icon="person-add-outline" onPress={() => setAdded(null)} style={{ marginTop: space.xl }} />
        <Button variant="ghost" title="Done" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Chip label="One person" selected={mode === 'one'} onPress={() => setMode('one')} />
        <Chip label="Paste a list" selected={mode === 'many'} onPress={() => setMode('many')} />
      </View>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}

      {mode === 'one' ? (
        <>
          <Field label="Full name">
            <Input value={name} onChangeText={setName} placeholder="e.g. Emeka Obi" />
          </Field>
          <Field label="Their email (e.g. Gmail)" hint="Optional. You can send the code straight to this email, and it will only work for an account made with it.">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="name@gmail.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>
          <RolePicker
            role={role}
            subjectId={subjectId}
            onChange={(r, sub) => {
              setRole(r);
              setSubjectId(sub);
            }}
          />
          <Button title="Add and get join code" icon="person-add-outline" onPress={addOne} loading={busy} />
        </>
      ) : (
        <>
          <Field label="Teachers' names" hint="One name per line. You can copy a column from Excel or Google Sheets.">
            <Input
              value={list}
              onChangeText={setList}
              placeholder={'Emeka Obi\nFatima Bello\nGrace Adeyemi'}
              multiline
              style={{ minHeight: 160, textAlignVertical: 'top' }}
            />
          </Field>
          <Button
            title={names.length > 0 ? `Add ${names.length} ${names.length === 1 ? 'teacher' : 'teachers'}` : 'Add teachers'}
            icon="people-outline"
            onPress={addMany}
            loading={busy}
            disabled={names.length === 0}
          />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.md }}>
            Each person gets their own join code. Open them from the staff list to share their code.
          </Text>
        </>
      )}
    </Screen>
  );
}
