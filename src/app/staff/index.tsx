import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { colors } from '../../components/theme';
import { Badge, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { formatCode } from '../../lib/invites';
import { roleLabel, useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load(schoolId: string, isAdmin: boolean) {
  const [staff, invites] = await Promise.all([
    supabase.from('staff').select('id, full_name, role, user_id, subjects(name)').eq('school_id', schoolId).order('full_name').then(must),
    isAdmin
      ? supabase.from('staff_invites').select('staff_id, code').eq('school_id', schoolId).then(must)
      : Promise.resolve([] as { staff_id: string; code: string }[]),
  ]);
  const codes = new Map(invites.map((i) => [i.staff_id, i.code]));
  return staff.map((s) => ({ ...s, code: codes.get(s.id) ?? null }));
}

export default function StaffList() {
  const { schoolId, isAdmin, staffId: myStaffId } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId, isAdmin), `${schoolId}:${isAdmin}`);

  const header = isAdmin ? (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable onPress={() => router.push('/staff/add')} hitSlop={12} accessibilityLabel="Add staff">
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </Pressable>
        ),
      }}
    />
  ) : null;

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;

  const staff = data ?? [];
  const waiting = staff.filter((s) => !s.user_id);
  const joined = staff.filter((s) => s.user_id);
  const open = (id: string) => (isAdmin ? () => router.push({ pathname: '/staff/[id]', params: { id } }) : undefined);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {header}
      {staff.length <= 1 && isAdmin ? (
        <EmptyState
          icon="people-outline"
          title="Add your teachers"
          text="Each person you add gets their own join code to share with them on WhatsApp or SMS."
        />
      ) : null}

      {waiting.length > 0 ? (
        <>
          <SectionTitle>Not joined yet</SectionTitle>
          <Group>
            {waiting.map((s) => (
              <ListRow
                key={s.id}
                title={s.full_name}
                subtitle={s.code ? `Join code: ${formatCode(s.code)}` : 'Waiting to join'}
                right={s.role !== 'teacher' ? <Badge label={roleLabel(s.role, s.subjects?.name)} tone="primary" /> : undefined}
                onPress={open(s.id)}
              />
            ))}
          </Group>
        </>
      ) : null}

      <SectionTitle>Joined</SectionTitle>
      <Group>
        {joined.map((s) => (
          <ListRow
            key={s.id}
            title={s.id === myStaffId ? `${s.full_name} (you)` : s.full_name}
            right={<Badge label={roleLabel(s.role, s.subjects?.name)} tone={s.role === 'teacher' ? 'neutral' : 'primary'} />}
            onPress={open(s.id)}
          />
        ))}
      </Group>
    </Screen>
  );
}
