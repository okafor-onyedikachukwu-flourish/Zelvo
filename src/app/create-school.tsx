import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { accountName, useAuth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { useSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';

export default function CreateSchool() {
  const { session } = useAuth();
  const { refresh, switchSchool } = useSchool();
  const [schoolName, setSchoolName] = useState('');
  const [yourName, setYourName] = useState(accountName(session));
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = getCalendars()[0]?.timeZone ?? 'UTC';

  async function submit() {
    if (schoolName.trim().length < 2) return setError('Enter the school name.');
    if (yourName.trim().length < 2) return setError('Enter your name.');
    setBusy(true);
    setError(null);
    try {
      const schoolId = must(
        await supabase.rpc('create_school', {
          p_name: schoolName.trim(),
          p_admin_name: yourName.trim(),
          p_country: country.trim() || undefined,
          p_timezone: timezone,
        }),
      );
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
      <Field label="School name">
        <Input value={schoolName} onChangeText={setSchoolName} placeholder="e.g. Unity Secondary School" />
      </Field>
      <Field label="Your name" hint="This is how staff will see you. You'll be the school's principal: you approve staff and see every result.">
        <Input value={yourName} onChangeText={setYourName} placeholder="e.g. Ngozi Okafor" />
      </Field>
      <Field label="Country (optional)">
        <Input value={country} onChangeText={setCountry} placeholder="e.g. Nigeria" />
      </Field>
      <Field label="Time zone" hint="Taken from your phone. Used for timetable alarms.">
        <Input value={timezone} editable={false} style={{ color: '#64748B' }} />
      </Field>
      <Button title="Create school" icon="checkmark" onPress={submit} loading={busy} />
    </Screen>
  );
}
