import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../../components/theme';
import { Banner, Brand, Button, Card, Screen, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { useSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

export default function StudentWaiting() {
  const { studentAccounts, refresh, isOwner } = useSchool();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const request = studentAccounts.find((a) => a.status !== 'approved');

  async function check() {
    setBusy('check');
    await refresh();
    setBusy(null);
  }

  async function cancel() {
    if (!request) return;
    if (!(await confirm('Cancel your request?', `You won't join ${request.schoolName}.`, 'Cancel request'))) return;
    setBusy('cancel');
    try {
      must(await supabase.from('student_accounts').delete().eq('id', request.id));
      await refresh();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={busy === 'check'} onRefresh={check}>
        <Brand />
        {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}
        {request?.status === 'declined' ? (
          <Banner
            tone="warning"
            icon="close-circle-outline"
            title="Your request wasn't approved"
            text="Check your school, class and name with your teacher, then ask again."
          />
        ) : (
          <Banner tone="info" icon="time-outline" title="Waiting for your teacher" text="A teacher or admin at your school needs to approve you. Pull down to check again." />
        )}
        {request ? (
          <Card style={{ gap: 4, marginBottom: space.lg }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{request.typedName}</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>
              {request.className} · {request.schoolName}
            </Text>
          </Card>
        ) : null}
        <Button title="Check again" icon="refresh" onPress={check} loading={busy === 'check'} />
        <Button
          variant="secondary"
          icon="create-outline"
          title={request?.status === 'declined' ? 'Ask again' : 'Change my details'}
          onPress={() => router.push('/student/join')}
          style={{ marginTop: space.sm }}
        />
        <Button
          variant="secondary"
          icon="key-outline"
          title="I have a code from my teacher"
          onPress={() => router.push('/student/join')}
          style={{ marginTop: space.sm }}
        />
        {request ? <Button variant="ghost" title="Cancel request" onPress={cancel} loading={busy === 'cancel'} style={{ marginTop: space.sm }} /> : null}
        {isOwner ? <Button variant="ghost" icon="globe-outline" title="Zelvo owner dashboard" onPress={() => router.push('/owner')} /> : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.lg }} />
      </Screen>
    </SafeAreaView>
  );
}
