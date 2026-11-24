import { router } from 'expo-router';
import { useState } from 'react';
import { CodeInput } from '../components/CodeInput';
import { Banner, Button, Field, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';

export default function JoinSchool() {
  const { refresh, switchSchool } = useSchool();
  const [clean, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Field label="Your join code" hint="Your head of school gives each member of staff their own code, often by email.">
        <CodeInput value={clean} onChange={setCode} onSubmit={submit} />
      </Field>
      <Button title="Join school" icon="log-in-outline" onPress={submit} loading={busy} />
    </Screen>
  );
}
