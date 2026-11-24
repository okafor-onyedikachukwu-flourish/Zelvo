import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { colors, space } from '../../components/theme';
import { Button, Card, Group, ListRow, Screen, SectionTitle, confirm } from '../../components/ui';
import { accountName, useAuth } from '../../lib/auth';
import { useSchool } from '../../lib/school';
import { supabase } from '../../lib/supabase';

export default function Account() {
  const { session } = useAuth();
  const { memberships, current, switchSchool } = useSchool();

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
            subtitle={m.role === 'admin' ? 'Admin' : 'Teacher'}
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

      <Button variant="danger" icon="log-out-outline" title="Log out" onPress={logOut} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
