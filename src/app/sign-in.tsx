import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmailCodeStep, EmailHint, GoogleButton, PasswordInput } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { PhotoStrip } from '../components/Photo';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { PHOTOS } from '../lib/photos';
import { cleanEmail, suggestEmail } from '../lib/signup';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const suggestion = suggestEmail(email);

  async function submit() {
    const mail = cleanEmail(email);
    if (!mail || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (err) throw err;
      // On success the app moves on by itself.
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'email_not_confirmed') {
        // Send a fresh code and let them confirm right here.
        await supabase.auth.resend({ type: 'signup', email: mail });
        setConfirming(true);
      } else {
        setError(friendlyError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Screen>
          <EmailCodeStep
            email={cleanEmail(email)}
            type="email"
            title="Confirm your email first"
            submitTitle="Confirm and log in"
            onBack={() => setConfirming(false)}
          />
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <PhotoStrip photo={PHOTOS.classroom} />
        <Text style={{ fontSize: 27, lineHeight: 33, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: space.lg }}>Welcome back</Text>
        <Text style={{ fontSize: 15, color: colors.muted, marginTop: 2, marginBottom: space.lg }}>Log in to your Zelvo account.</Text>
        {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}

        <GoogleButton onError={setError} />

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="name@gmail.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </Field>
        <EmailHint suggestion={suggestion} onAccept={setEmail} />
        <Field label="Password">
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </Field>
        <Button
          variant="ghost"
          small
          title="Forgot password?"
          onPress={() => router.push({ pathname: '/forgot-password', params: { email: cleanEmail(email) } })}
          style={{ alignSelf: 'flex-end', marginTop: -space.sm, marginBottom: space.sm }}
        />
        <Button title="Log in" onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title="New to Zelvo? Get started"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/start'))}
          style={{ marginTop: space.sm }}
        />
      </Screen>
    </SafeAreaView>
  );
}
