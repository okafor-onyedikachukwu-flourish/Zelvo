import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { EmailCodeStep, EmailHint, PasswordInput } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { cleanEmail, looksLikeEmail, suggestEmail } from '../lib/signup';
import { supabase } from '../lib/supabase';

/**
 * Reset a forgotten password with a code sent by email. Entering the right code logs the person in,
 * and the app may move on to its main screens straight away, so the result is shown in a pop-up.
 */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mail = cleanEmail(email);

  async function send() {
    if (!looksLikeEmail(mail)) return setError('Enter the email you use for Zelvo.');
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail);
      if (err) throw err;
      setStep('code');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <Screen>
        <EmailCodeStep
          email={mail}
          type="recovery"
          title="Check your email"
          submitTitle="Save new password"
          beforeVerify={() => (password.length < 6 ? 'Choose a new password of at least 6 characters.' : null)}
          onVerified={async () => {
            // The app may already be reloading for the logged-in person; move on once they tap OK.
            const { error: err } = await supabase.auth.updateUser({ password });
            const ok = [{ text: 'OK', onPress: () => router.replace('/') }];
            if (err) {
              Alert.alert(
                'Password not changed',
                `${friendlyError(err)} You're logged in now. To try again, log out and tap "Forgot password?".`,
                ok,
              );
            } else {
              Alert.alert('Password changed', "You're logged in. Use your new password next time.", ok);
            }
          }}
          onBack={() => setStep('email')}
        >
          <Field label="New password" hint="At least 6 characters.">
            <PasswordInput value={password} onChangeText={setPassword} placeholder="Choose a new password" autoComplete="new-password" />
          </Field>
        </EmailCodeStep>
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: space.lg }}>
        Enter your email and we&apos;ll send you a code to choose a new password. If you joined with Google, just tap
        &quot;Continue with Google&quot; instead.
      </Text>
      <Field label="Email">
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="name@gmail.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={send}
        />
      </Field>
      <EmailHint suggestion={suggestEmail(email)} onAccept={setEmail} />
      <Button title="Send code" icon="mail-outline" onPress={send} loading={busy} />
    </Screen>
  );
}
