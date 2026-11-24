import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Banner, Button, Chip, Field, Group, Input, ListRow, Screen, SectionTitle } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

type School = { id: string; name: string; country: string | null };

export default function StudentJoin() {
  const { session } = useAuth();
  const { refresh } = useSchool();
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [name, setName] = useState(accountName(session));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Search schools as the student types.
  useEffect(() => {
    if (school || query.trim().length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('find_schools', { p_query: query.trim() });
      if (active) setSchools(data ?? []);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, school]);

  async function chooseSchool(s: School) {
    setSchool(s);
    setClassId('');
    setMessage(null);
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
      must(await supabase.rpc('request_student_access', { p_school: school.id, p_class: classId, p_name: name.trim() }));
      await refresh();
      router.replace('/student/waiting');
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <SectionTitle>1. Your school</SectionTitle>
      {school ? (
        <Group>
          <ListRow
            icon="business-outline"
            title={school.name}
            subtitle={school.country ?? undefined}
            right={<Button small variant="ghost" title="Change" onPress={() => setSchool(null)} />}
          />
        </Group>
      ) : (
        <>
          <Input value={query} onChangeText={setQuery} placeholder="Type your school's name" autoFocus />
          {query.trim().length >= 2 ? (
            schools.length > 0 ? (
              <View style={{ marginTop: space.sm }}>
                <Group>
                  {schools.map((s) => (
                    <ListRow key={s.id} icon="business-outline" title={s.name} subtitle={s.country ?? undefined} onPress={() => chooseSchool(s)} />
                  ))}
                </Group>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
                No school found. Check the spelling, or ask your teacher whether your school uses Zelvo.
              </Text>
            )
          ) : null}
        </>
      )}

      {school ? (
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
          <Field label="Full name" hint="Write it the way your school writes it, so your teacher can find you on the class list.">
            <Input value={name} onChangeText={setName} placeholder="e.g. Okeke Chidinma" />
          </Field>
          <Button title="Ask to join" icon="send-outline" onPress={submit} loading={busy} />
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
            A teacher at your school will approve you. Then you can see your results here.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
