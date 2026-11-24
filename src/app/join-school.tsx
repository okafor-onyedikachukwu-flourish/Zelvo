import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { formatCode } from '../lib/invites';
import { useSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';

export default function JoinSchool() {
  const { refresh, switchSchool } = useSchool();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  async function submit() {
    if (clean.length !== 8) return setError('The code has 8 letters and numbers, like AB3D-EF7H.');
    setBusy(true);
    setError(null);
    try {
      const schoolId = must(await supabase.rpc('join_school', { p_code: clean }));
      await refresh();
      await switchSchool(schoolId);
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Field label="Your join code" hint="Ask your school admin for your code. Each teacher has their own.">
        <Input
          value={clean.length > 4 ? formatCode(clean.padEnd(8, ' ')).trim() : clean}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          placeholder="AB3D-EF7H"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center', fontWeight: '700' }}
          onSubmitEditing={submit}
        />
      </Field>
      <Button title="Join school" icon="log-in-outline" onPress={submit} loading={busy} />
    </Screen>
  );
}
