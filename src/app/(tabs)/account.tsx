import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { colors, space } from '../../components/theme';
import { Button, Card, Group, ListRow, Screen, SectionTitle, confirm } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { useState } from 'react';
import { friendlyError } from '../../lib/errors';
import { roleLabel, useSchool } from '../../lib/school';
import { supabase } from '../../lib/supabase';
import { checkForUpdate, currentBuild, downloadAndInstall } from '../../lib/updates';

export default function Account() {
  const { session } = useAuth();
  const { memberships, current, switchSchool, isOwner } = useSchool();
  const [updateState, setUpdateState] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function update() {
    setUpdating(true);
    setUpdateState('Checking…');
    try {
      const u = await checkForUpdate(true);
      if (!u) {
        setUpdateState('You have the latest version.');
        return;
      }
      await downloadAndInstall(u, (f) => setUpdateState(`Downloading build ${u.build}… ${Math.round(f * 100)}%`));
      setUpdateState(null);
    } catch (e) {
      setUpdateState(friendlyError(e));
    } finally {
      setUpdating(false);
    }
  }

  async function logOut() {
    if (await confirm('Log out?', 'You can log back in with your email and password.', 'Log out')) {
      await supabase.auth.signOut();
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{accountName(session) || 'Your account'}</Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>{session?.user.email}</Text>
      </Card>

      <SectionTitle>Your schools</SectionTitle>
      <Group>
        {memberships.map((m) => (
          <ListRow
            key={m.school.id}
            icon="business-outline"
            title={m.school.name}
            subtitle={roleLabel(m.role)}
            right={
              m.school.id === current?.school.id ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : undefined
            }
            onPress={m.school.id === current?.school.id ? undefined : () => switchSchool(m.school.id)}
          />
        ))}
      </Group>
      <Button
        variant="secondary"
        icon="key-outline"
        title="Join another school"
        onPress={() => router.push('/join-school')}
        style={{ marginTop: space.md }}
      />
      <Button
        variant="secondary"
        icon="add"
        title="Set up another school"
        onPress={() => router.push('/create-school')}
        style={{ marginTop: space.sm }}
      />

      <SectionTitle>App</SectionTitle>
      <Group>
        <ListRow
          icon="arrow-up-circle-outline"
          title="Check for updates"
          subtitle={updateState ?? `This is build ${currentBuild() || '–'}. Tap to update if there's a newer one.`}
          onPress={updating ? undefined : update}
        />
        {isOwner ? (
          <ListRow icon="globe-outline" title="Zelvo owner dashboard" subtitle="Every school using Zelvo" onPress={() => router.push('/owner')} />
        ) : null}
      </Group>

      <Button variant="danger" icon="log-out-outline" title="Log out" onPress={logOut} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
