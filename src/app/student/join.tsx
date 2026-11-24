import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SchoolSearch, type FoundSchool } from '../../components/SchoolSearch';
import { colors, space } from '../../components/theme';
import { Banner, Button, Chip, Field, Input, Screen, SectionTitle } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

/** Students pick their school, class and name, then go straight to their dashboard. */
export default function StudentJoin() {
  const { session } = useAuth();
  const { refresh } = useSchool();
  const [school, setSchool] = useState<FoundSchool | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[] | null>(null);
  const [classId, setClassId] = useState('');
  const [name, setName] = useState(accountName(session));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function chooseSchool(s: FoundSchool | null) {
    setSchool(s);
    setClasses(null);
    setClassId('');
    setMessage(null);
    if (!s) return;
    try {
      setClasses(must(await supabase.rpc('school_classes', { p_school: s.id })));
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  async function submit() {
    if (!school) return setMessage('Choose your school.');
    if (!classId) return setMessage('Choose your class.');
    if (name.trim().length < 2) return setMessage('Enter your full name as your school writes it.');
    setBusy(true);
    setMessage(null);
    try {
      must(await supabase.rpc('join_class', { p_school: school.id, p_class: classId, p_name: name.trim() }));
      await refresh();
      router.replace('/student');
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <SectionTitle>1. Your school</SectionTitle>
      <SchoolSearch school={school} onChange={chooseSchool} />

      {school && classes ? (
        <>
          <SectionTitle>2. Your class</SectionTitle>
          {classes.length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.muted }}>This school hasn&apos;t added its classes yet. Ask your teacher.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {classes.map((c) => (
                <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(c.id)} />
              ))}
            </View>
          )}

          <SectionTitle>3. Your name</SectionTitle>
          <Field label="Full name" hint="Write it the way your school writes it, so your teacher can confirm you quickly.">
            <Input value={name} onChangeText={setName} placeholder="e.g. Okeke Chidinma" autoCapitalize="words" />
          </Field>
          <Button title="Go to my dashboard" icon="arrow-forward" onPress={submit} loading={busy} disabled={!classId} />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
            Your scores appear once a teacher confirms you.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
