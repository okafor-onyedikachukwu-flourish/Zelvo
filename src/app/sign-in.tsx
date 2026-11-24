import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/theme';
import { Banner, Brand, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(friendlyError(err));
    // On success the app moves on by itself.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand subtitle="Timetable alarms and exam marking for teachers" />
        {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        </Field>
        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={submit}
          />
        </Field>
        <Button title="Log in" onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title="New to Zelvo? Create an account"
          onPress={() => router.push('/sign-up')}
          style={{ marginTop: 8 }}
        />
      </Screen>
    </SafeAreaView>
  );
}
