import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 6) return setError('Use a password of at least 6 characters.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    // If email confirmation is switched on, there's no session until the link is opened.
    if (!data.session) setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <Screen>
        <Banner
          tone="success"
          icon="mail-outline"
          title="Check your email"
          text={`We sent a link to ${email.trim()}. Open it to confirm your account, then come back and log in.`}
        />
        <Button title="Back to log in" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Field label="Full name" hint="Use the name your school knows you by.">
        <Input value={name} onChangeText={setName} placeholder="e.g. Ngozi Okafor" autoComplete="name" />
      </Field>
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
      <Field label="Password" hint="At least 6 characters.">
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Choose a password"
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
      </Field>
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
