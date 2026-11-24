import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MAX_HODS_PER_DEPARTMENT } from '../../components/RolePicker';
import { SchoolSearch, type FoundSchool } from '../../components/SchoolSearch';
import { colors, space } from '../../components/theme';
import { Banner, Button, Chip, Field, Input, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

type AppliedAs = 'vp_academic' | 'hod' | 'teacher';
type Options = { subjects: { id: string; name: string }[]; hasVp: boolean; full: Set<string> };

const TITLES: Record<AppliedAs, string> = {
  vp_academic: 'Vice-principal academic',
  hod: 'Head of department',
  teacher: 'Teacher',
};

/** Pick your school (and department or subjects), then ask the principal to approve you. */
export default function JoinSchool() {
  const params = useLocalSearchParams<{ as?: string }>();
  const appliedAs: AppliedAs = params.as === 'vp_academic' || params.as === 'hod' ? params.as : 'teacher';
  const { session } = useAuth();
  const { refresh } = useSchool();
  const [school, setSchool] = useState<FoundSchool | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(accountName(session));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function chooseSchool(s: FoundSchool | null) {
    setSchool(s);
    setOptions(null);
    setPicked([]);
    setMessage(null);
    if (!s) return;
    try {
      const [subjects, openings] = await Promise.all([
        supabase.rpc('school_subjects', { p_school: s.id }).then(must),
        supabase.rpc('school_openings', { p_school: s.id }).then(must),
      ]);
      setOptions({ subjects, hasVp: !!openings[0]?.has_vp, full: new Set(openings[0]?.full_departments ?? []) });
    } catch (e) {
      setMessage(friendlyError(e));
    }
  }

  function toggle(id: string) {
    if (appliedAs === 'hod') setPicked([id]);
    else setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit() {
    if (!school) return setMessage('Choose your school.');
    if (appliedAs === 'hod' && picked.length !== 1) return setMessage('Choose your department.');
    if (appliedAs === 'teacher' && picked.length === 0) return setMessage('Choose at least one subject you teach.');
    if (name.trim().length < 2) return setMessage('Enter your full name.');
    setBusy(true);
    setMessage(null);
    try {
      must(
        await supabase.rpc('request_staff_access', {
          p_school: school.id,
          p_applied_as: appliedAs,
          p_name: name.trim(),
          p_subjects: appliedAs === 'vp_academic' ? [] : picked,
        }),
      );
      await refresh();
      router.replace('/staff-waiting');
    } catch (e) {
      setMessage(friendlyError(e));
      setBusy(false);
    }
  }

  const noSubjects = options && options.subjects.length === 0 && appliedAs !== 'vp_academic';
  const vpTaken = options?.hasVp && appliedAs === 'vp_academic';

  return (
    <Screen>
      <Stack.Screen options={{ title: TITLES[appliedAs] }} />
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      <SectionTitle>1. Your school</SectionTitle>
      <SchoolSearch school={school} onChange={chooseSchool} />

      {school && !options && !message ? <LoadingView /> : null}

      {options ? (
        <>
          {appliedAs !== 'vp_academic' ? (
            <SectionTitle>{appliedAs === 'hod' ? '2. Select your department' : '2. Select the subjects you teach'}</SectionTitle>
          ) : null}
          {noSubjects ? (
            <Banner
              tone="warning"
              icon="information-circle-outline"
              title="This school hasn't added its departments yet"
              text="Ask your vice-principal academic or principal to add them in Zelvo, then come back."
            />
          ) : appliedAs !== 'vp_academic' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm }}>
              {options.subjects.map((s) => {
                const full = appliedAs === 'hod' && options.full.has(s.id);
                return (
                  <Chip
                    key={s.id}
                    label={full ? `${s.name} (full)` : s.name}
                    selected={picked.includes(s.id)}
                    disabled={full}
                    onPress={() => toggle(s.id)}
                  />
                );
              })}
            </View>
          ) : null}
          {appliedAs === 'hod' && options.full.size > 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.sm }}>
              A department marked full already has {MAX_HODS_PER_DEPARTMENT} heads.
            </Text>
          ) : null}
          {appliedAs === 'teacher' && !noSubjects ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.sm }}>Tap every subject you teach.</Text>
          ) : null}

          {vpTaken ? (
            <Banner
              tone="warning"
              icon="information-circle-outline"
              title="This school already has a vice-principal academic"
              text="If that's wrong, ask your principal to change it in Zelvo."
            />
          ) : null}

          {!noSubjects && !vpTaken ? (
            <>
              <SectionTitle>{appliedAs === 'vp_academic' ? '2. Your name' : '3. Your name'}</SectionTitle>
              <Field label="Full name" hint="As your school knows you.">
                <Input value={name} onChangeText={setName} autoCapitalize="words" />
              </Field>
              <Button title="Ask to join" icon="send-outline" onPress={submit} loading={busy} />
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
                Your principal or vice-principal approves you. Then you&apos;re in.
              </Text>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
