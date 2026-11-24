import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { CodeInput } from '../components/CodeInput';
import { colors, space } from '../components/theme';
import { Banner, Button, Card, Field, Screen } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { describeCode, lookUpCode, type CodeInfo } from '../lib/signup';

/** Check a join code before making an account, so the person can see who it's for. */
export default function CodeCheck() {
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (code.length !== 8) return setError('The code has 8 letters and numbers, like AB3D-EF7H.');
    setBusy(true);
    setError(null);
    try {
      const found = await lookUpCode(code);
      if (!found) setError("That code wasn't found. Check each character, or ask for a new code. It may already have been used.");
      setInfo(found);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (info) {
    return (
      <Screen>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space.md }}>Is this you?</Text>
        <Card style={{ gap: 6, marginBottom: space.lg }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{info.personName}</Text>
          <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '600' }}>{describeCode(info)}</Text>
          <Text style={{ fontSize: 15, color: colors.muted }}>{info.schoolName}</Text>
          {info.email ? (
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: space.sm }}>
              This code only works with the email <Text style={{ fontWeight: '700', color: colors.text }}>{info.email}</Text>
            </Text>
          ) : null}
        </Card>
        <Button
          title="Yes, create my account"
          icon="person-add-outline"
          onPress={() => router.push({ pathname: '/sign-up', params: { code: info.code } })}
        />
        <Button
          variant="secondary"
          title="I already have a Zelvo account"
          onPress={() => router.push({ pathname: '/sign-in', params: { code: info.code } })}
          style={{ marginTop: space.sm }}
        />
        <Button variant="ghost" title="No, that's not me" onPress={() => setInfo(null)} style={{ marginTop: space.sm }} />
        <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space.sm }}>
          If the name or role is wrong, ask whoever sent the code to fix it. You don&apos;t need a new code.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Field label="Your join code" hint="Check your email (and Spam), WhatsApp or SMS for the code you were sent.">
        <CodeInput value={code} onChange={setCode} onSubmit={check} />
      </Field>
      <View style={{ gap: space.sm }}>
        <Button title="Continue" icon="arrow-forward" onPress={check} loading={busy} disabled={code.length !== 8} />
      </View>
    </Screen>
  );
}
