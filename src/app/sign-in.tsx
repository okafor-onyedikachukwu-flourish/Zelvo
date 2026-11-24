import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmailCodeStep, EmailHint, GoogleButton, PasswordInput } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Banner, Brand, Button, Card, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { cachedCode, cleanEmail, describeCode, forgetCode, rememberCode, suggestEmail } from '../lib/signup';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const params = useLocalSearchParams<{ code?: string; email?: string }>();
  const info = params.code ? cachedCode(params.code) : null;
  const [email, setEmail] = useState(params.email ?? info?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const suggestion = suggestEmail(email);

  // A code typed before logging in is used as soon as the log-in works.
  const prepare = async () => {
    if (params.code) await rememberCode(params.code, info?.kind ?? 'staff');
  };
  const undo = () => forgetCode();

  async function submit() {
    const mail = cleanEmail(email);
    if (!mail || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      await prepare();
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
        await undo();
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
        <Brand subtitle="Welcome back" />
        {info ? (
          <Card style={{ gap: 4, marginBottom: space.lg }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>Log in to join</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{info.schoolName}</Text>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>{describeCode(info)}</Text>
          </Card>
        ) : null}
        {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}

        <GoogleButton beforeStart={prepare} onCancel={undo} onError={setError} />

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
