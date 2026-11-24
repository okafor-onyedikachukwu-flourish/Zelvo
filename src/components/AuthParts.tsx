// Building blocks for the sign-up and log-in screens.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentPropsWithRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { friendlyError } from '../lib/errors';
import { googleEnabled, signInWithGoogle } from '../lib/signup';
import { supabase } from '../lib/supabase';
import { colors, radius, space } from './theme';
import { Banner, Button, Field, Input, type IconName } from './ui';

/** Password box with an eye button to show or hide what's typed. */
export function PasswordInput(props: ComponentPropsWithRef<typeof TextInput>) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ justifyContent: 'center' }}>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!show}
        style={[{ paddingRight: 52 }, props.style]}
      />
      <Pressable
        onPress={() => setShow((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={show ? 'Hide password' : 'Show password'}
        hitSlop={10}
        style={{ position: 'absolute', right: 14 }}
      >
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/** "Did you mean ada@gmail.com?" under an email box. */
export function EmailHint({ suggestion, onAccept }: { suggestion: string | null; onAccept: (email: string) => void }) {
  if (!suggestion) return null;
  return (
    <Pressable onPress={() => onAccept(suggestion)} style={{ marginTop: -space.sm, marginBottom: space.md }}>
      <Text style={{ fontSize: 14, color: colors.warning }}>
        Did you mean <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>{suggestion}</Text>? Tap to fix.
      </Text>
    </Pressable>
  );
}

/** "Continue with Google", shown only once Google sign-in is switched on in Supabase. */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    googleEnabled().then((on) => {
      if (active) setEnabled(on);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  async function start() {
    setBusy(true);
    try {
      await signInWithGoogle();
      // When it works, the app moves on by itself; if the person closed Google, nothing happens.
    } catch (e) {
      onError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon="logo-google" title="Continue with Google" onPress={start} loading={busy} />
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or use your email</Text>
        <View style={styles.orLine} />
      </View>
    </>
  );
}

/** A big tappable choice with an icon, used on the start and welcome screens. */
export function OptionCard({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

/**
 * "We emailed you a code": used to confirm a new account (type 'email') and to reset a password
 * (type 'recovery'). onVerified runs after the code is accepted; the person is then signed in.
 */
export function EmailCodeStep({
  email,
  type,
  title,
  children,
  submitTitle,
  beforeVerify,
  onVerified,
  onBack,
}: {
  email: string;
  type: 'email' | 'recovery';
  title: string;
  /** Extra fields shown under the code box (e.g. a new password). */
  children?: React.ReactNode;
  submitTitle: string;
  /** Checks the extra fields first; return an error message to stop. */
  beforeVerify?: () => string | null;
  onVerified?: () => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const digits = code.replace(/\D/g, '');

  async function verify() {
    if (digits.length < 6) return setMessage({ tone: 'danger', text: 'Enter the code from the email.' });
    const problem = beforeVerify?.();
    if (problem) return setMessage({ tone: 'danger', text: problem });
    setBusy('verify');
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: digits, type });
      if (error) throw error;
      await onVerified?.();
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy('resend');
    setMessage(null);
    try {
      const { error } =
        type === 'recovery'
          ? await supabase.auth.resetPasswordForEmail(email)
          : await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setMessage({ tone: 'success', text: 'A new code is on its way. Use the newest email.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Banner
        tone="info"
        icon="mail-outline"
        title={title}
        text={`We emailed a code to ${email}. It can take a minute to arrive; check Spam or Promotions too.`}
      />
      {message ? (
        <Banner tone={message.tone} icon={message.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'} title={message.text} />
      ) : null}
      <Field label="Code from the email">
        <Input
          value={digits}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' }}
          onSubmitEditing={children ? undefined : verify}
        />
      </Field>
      {children}
      <Button title={submitTitle} onPress={verify} loading={busy === 'verify'} />
      <Button variant="ghost" title="Send a new code" onPress={resend} loading={busy === 'resend'} style={{ marginTop: space.sm }} />
      <Button variant="ghost" title="Use a different email" onPress={onBack} />
    </>
  );
}

const styles = StyleSheet.create({
  orRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: 13, color: colors.muted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    marginBottom: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 14, color: colors.muted },
});
