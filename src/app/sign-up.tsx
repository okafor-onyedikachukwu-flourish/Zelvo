import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { EmailCodeStep, EmailHint, GoogleButton, PasswordInput } from '../components/AuthParts';
import { PhotoStrip } from '../components/Photo';
import { colors, space } from '../components/theme';
import { Banner, Button, Field, Input, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { PHOTOS } from '../lib/photos';
import { cleanEmail, looksLikeEmail, suggestEmail } from '../lib/signup';
import { supabase } from '../lib/supabase';

/** The sign-up form. Once the account exists, the app asks "Who are you?". */
export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    setExists(false);
    const mail = cleanEmail(email);
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!looksLikeEmail(mail)) return setError('Enter your email, e.g. name@gmail.com.');
    if (password.length < 6) return setError('Choose a password of at least 6 characters.');
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: name.replace(/\s+/g, ' ').trim() } },
      });
      if (err) throw err;
      // With "Confirm email" on, there's no session until the emailed code is entered.
      if (!data.session) setConfirming(true);
      // Otherwise the app moves on by itself to "Who are you?".
    } catch (e) {
      const msg = friendlyError(e);
      setExists(/already exists/i.test(msg));
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <Screen>
        <EmailCodeStep
          email={cleanEmail(email)}
          type="email"
          title="Confirm your email"
          submitTitle="Confirm and continue"
          onBack={() => setConfirming(false)}
        />
      </Screen>
    );
  }

  const goToLogIn = () => router.replace({ pathname: '/sign-in', params: { email: cleanEmail(email) } });

  return (
    <Screen>
      <PhotoStrip photo={PHOTOS.signUp} />
      <Text style={{ fontSize: 27, lineHeight: 33, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: space.lg }}>Create your account</Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginTop: 2, marginBottom: space.lg }}>It takes less than a minute.</Text>
      {error ? (
        <Banner
          tone="danger"
          icon="alert-circle"
          title={error}
          action={exists ? <Button small title="Log in instead" onPress={goToLogIn} /> : undefined}
        />
      ) : null}

      <GoogleButton onError={setError} />

      <Field label="Full name" hint="The name your school knows you by.">
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ngozi Okafor"
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </Field>
      <Field label="Email">
        <Input
          ref={emailRef}
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
      <EmailHint suggestion={suggestEmail(email)} onAccept={setEmail} />
      <Field label="Password" hint="At least 6 characters. Tap the eye to check what you typed.">
        <PasswordInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="Choose a password"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Field>
      <Button title="Create account" onPress={submit} loading={busy} />
      <Button variant="ghost" title="Already have an account? Log in" onPress={goToLogIn} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
