import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../components/theme';
import { Banner, Brand, Button, Card, Screen, confirm } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { appliedAsLabel, useSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';

/** Shown to staff whose request to join a school hasn't been approved yet. */
export default function StaffWaiting() {
  const { staffRequests, refresh, isOwner } = useSchool();
  const request = staffRequests[0];
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const check = () => run('check', refresh);
  const cancel = () =>
    run('cancel', async () => {
      if (!request) return;
      if (!(await confirm('Cancel your request?', `You can choose again after.`, 'Cancel request'))) return;
      must(await supabase.from('staff_requests').delete().eq('id', request.id));
      await refresh();
    });
  const chooseAgain = () => router.push(request?.appliedAs === 'vp_academic' ? '/join/head' : '/join/staff');

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
            text="Check your school and position with your principal, then choose again."
          />
        ) : (
          <Banner
            tone="info"
            icon="time-outline"
            title="Waiting for approval"
            text="Your principal or vice-principal needs to approve you in Zelvo. Pull down to check again."
          />
        )}
        {request ? (
          <Card style={{ gap: 4, marginBottom: space.lg }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{request.fullName}</Text>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>{appliedAsLabel(request.appliedAs, request.subjectNames)}</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>{request.schoolName}</Text>
          </Card>
        ) : null}
        <Button title="Check again" icon="refresh" onPress={check} loading={busy === 'check'} />
        <Button variant="secondary" icon="create-outline" title="Choose again" onPress={chooseAgain} style={{ marginTop: space.sm }} />
        <Button variant="ghost" title="Cancel request" onPress={cancel} loading={busy === 'cancel'} style={{ marginTop: space.sm }} />
        {isOwner ? <Button variant="ghost" icon="globe-outline" title="Zelvo owner dashboard" onPress={() => router.push('/owner')} /> : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.lg }} />
      </Screen>
    </SafeAreaView>
  );
}
