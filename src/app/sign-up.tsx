import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';
import { EmailCodeStep, EmailHint, GoogleButton, PasswordInput } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Banner, Button, Card, Field, Input, LoadingView, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { looksLikeEmail } from '../lib/invites';
import {
  cachedCode,
  cleanEmail,
  describeCode,
  forgetCode,
  lookUpCode,
  rememberCode,
  setIntent,
  suggestEmail,
  type CodeInfo,
  type Intent,
} from '../lib/signup';
import { supabase } from '../lib/supabase';

export default function SignUp() {
  const params = useLocalSearchParams<{ code?: string; intent?: string }>();
  const code = params.code ?? '';
  const [info, setInfo] = useState<CodeInfo | null>(() => (code ? cachedCode(code) : null));
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Opened with a code but its details aren't loaded yet (e.g. after the app restarted).
  useEffect(() => {
    if (!code || info) return;
    let active = true;
    lookUpCode(code)
      .then((found) => {
        if (!active) return;
        if (found) setInfo(found);
        else setLookupError('That code is no longer valid. Ask for a new one.');
      })
      .catch((e) => active && setLookupError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [code, info]);

  if (code && !info) {
    return lookupError ? (
      <Screen>
        <Banner tone="danger" icon="alert-circle" title={lookupError} />
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    ) : (
      <LoadingView />
    );
  }
  const intent: Intent | null = params.intent === 'school' || params.intent === 'student' ? params.intent : null;
  return <SignUpForm info={info} intent={intent} />;
}

function SignUpForm({ info, intent }: { info: CodeInfo | null; intent: Intent | null }) {
  const lockedEmail = info?.email ?? null;
  const [name, setName] = useState(info?.personName ?? '');
  const [email, setEmail] = useState(lockedEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const suggestion = lockedEmail ? null : suggestEmail(email);

  // Remember what to do once the account exists: use the code, or open "set up a school" / "find my school".
  async function prepare() {
    setIntent(intent);
    if (info) await rememberCode(info.code, info.kind);
  }
  async function undo() {
    setIntent(null);
    await forgetCode();
  }

  async function submit() {
    setExists(false);
    const mail = cleanEmail(email);
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!looksLikeEmail(mail)) return setError('Enter your email, e.g. name@gmail.com.');
    if (password.length < 6) return setError('Choose a password of at least 6 characters.');
    setBusy(true);
    setError(null);
    try {
      await prepare();
      const { data, error: err } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: name.replace(/\s+/g, ' ').trim() } },
      });
      if (err) throw err;
      // With "Confirm email" on, there's no session until the emailed code is entered.
      if (!data.session) setConfirming(true);
      // Otherwise the app moves on by itself.
    } catch (e) {
      await undo();
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

  const goToLogIn = () =>
    router.replace({ pathname: '/sign-in', params: { email: cleanEmail(email), ...(info ? { code: info.code } : {}) } });

  return (
    <Screen>
      {info ? (
        <Card style={{ gap: 4, marginBottom: space.lg }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>You&apos;re joining</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{info.schoolName}</Text>
          <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>{describeCode(info)}</Text>
        </Card>
      ) : null}
      {error ? (
        <Banner
          tone="danger"
          icon="alert-circle"
          title={error}
          action={exists ? <Button small title="Log in instead" onPress={goToLogIn} /> : undefined}
        />
      ) : null}

      <GoogleButton beforeStart={prepare} onCancel={undo} onError={setError} />

      <Field label="Full name" hint={info ? 'As your school wrote it. You can correct it.' : 'The name your school knows you by.'}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ngozi Okafor"
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => (lockedEmail ? passwordRef : emailRef).current?.focus()}
        />
      </Field>
      <Field
        label="Email"
        hint={lockedEmail ? 'Your code only works with this email. Wrong email? Ask whoever sent the code to change it.' : undefined}
      >
        <Input
          ref={emailRef}
          value={email}
          onChangeText={setEmail}
          editable={!lockedEmail}
          placeholder="name@gmail.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={lockedEmail ? { color: colors.muted } : undefined}
        />
      </Field>
      <EmailHint suggestion={suggestion} onAccept={setEmail} />
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
