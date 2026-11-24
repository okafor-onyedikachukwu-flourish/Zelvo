import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';

export default function SchoolDetails() {
  const { school, schoolId, isAdmin, refresh } = useCurrentSchool();
  const [name, setName] = useState(school.name);
  const [country, setCountry] = useState(school.country ?? '');
  const [timezone, setTimezone] = useState(school.timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneZone = getCalendars()[0]?.timeZone ?? null;

  async function save() {
    if (name.trim().length < 2) return setError('Enter the school name.');
    setBusy(true);
    setError(null);
    try {
      must(
        await supabase
          .from('schools')
          .update({ name: name.trim(), country: country.trim() || null, timezone })
          .eq('id', schoolId)
          .select('id')
          .single(),
      );
      await refresh();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Field label="School name">
        <Input value={name} onChangeText={setName} editable={isAdmin} />
      </Field>
      <Field label="Country">
        <Input value={country} onChangeText={setCountry} placeholder="e.g. Nigeria" editable={isAdmin} />
      </Field>
      <Field label="Time zone" hint="Timetable alarms follow this time zone.">
        <Input value={timezone} editable={false} style={{ color: '#64748B' }} />
      </Field>
      {isAdmin && phoneZone && phoneZone !== timezone ? (
        <Button
          variant="secondary"
          small
          icon="phone-portrait-outline"
          title={`Use my phone's time zone (${phoneZone})`}
          onPress={() => setTimezone(phoneZone)}
          style={{ marginBottom: 16, alignSelf: 'flex-start' }}
        />
      ) : null}
      {isAdmin ? <Button title="Save" icon="checkmark" onPress={save} loading={busy} /> : null}
    </Screen>
  );
}
