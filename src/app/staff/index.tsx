import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, space } from '../../components/theme';
import { Badge, Banner, Button, Card, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { appliedAsLabel, roleLabel, useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';
import { PHOTOS } from '../../lib/photos';

async function load(schoolId: string, isAdmin: boolean) {
  const [staff, requests] = await Promise.all([
    supabase
      .from('staff')
      .select('id, full_name, role, head_title, user_id, subjects!staff_subject_school_fkey(name)')
      .eq('school_id', schoolId)
      .not('user_id', 'is', null)
      .order('full_name')
      .then(must),
    isAdmin ? supabase.rpc('school_staff_requests', { p_school: schoolId }).then(must) : Promise.resolve([]),
  ]);
  return { staff, requests };
}

const ORDER: Record<string, number> = { principal: 0, vp_academic: 1 };

export default function StaffList() {
  const { schoolId, isAdmin, refresh: refreshSchools } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId, isAdmin), `${schoolId}:${isAdmin}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const { staff, requests } = data!;
  const heads = staff
    .filter((s) => s.role === 'admin')
    .sort((a, b) => (ORDER[a.head_title ?? ''] ?? 2) - (ORDER[b.head_title ?? ''] ?? 2));
  const others = staff.filter((s) => s.role !== 'admin');
  const open = (id: string) => (isAdmin ? () => router.push({ pathname: '/staff/[id]', params: { id } }) : undefined);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setMessage(null);
    try {
      must(await supabase.rpc('decide_staff_request', { p_request: id, p_approve: approve }));
      await reload();
      await refreshSchools();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {message ? <Banner tone="danger" icon="alert-circle" title={message} /> : null}

      {isAdmin ? (
        <>
          <SectionTitle>{`Asking to join (${requests.length})`}</SectionTitle>
          {requests.length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: space.md }}>
              Staff join from their own phones: they create an account, tap Staff (or Head of school), and choose this
              school. They appear here for you to approve.
            </Text>
          ) : (
            requests.map((r) => (
              <Card key={r.id} style={{ marginBottom: space.sm, gap: space.sm }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r.full_name}</Text>
                  <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>
                    {appliedAsLabel(r.applied_as, r.subject_names)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>{r.email}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button small icon="checkmark" title="Approve" onPress={() => decide(r.id, true)} loading={busy === r.id} />
                  <Button small variant="danger" title="Decline" onPress={() => decide(r.id, false)} disabled={busy === r.id} />
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}

      <SectionTitle>Heads of school</SectionTitle>
      <Group>
        {heads.map((s) => (
          <ListRow
            key={s.id}
            icon="ribbon-outline"
            title={s.full_name}
            subtitle={roleLabel(s.role, null, s.head_title)}
            onPress={open(s.id)}
          />
        ))}
      </Group>

      <SectionTitle>{`Staff (${others.length})`}</SectionTitle>
      {others.length === 0 ? (
        <EmptyState photo={PHOTOS.staff} icon="people-outline" title="No staff yet" text="Teachers and heads of department appear here once approved." />
      ) : (
        <Group>
          {others.map((s) => (
            <ListRow
              key={s.id}
              icon="person-outline"
              title={s.full_name}
              right={<Badge label={roleLabel(s.role, s.subjects?.name)} tone={s.role === 'hod' ? 'primary' : 'neutral'} />}
              onPress={open(s.id)}
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}
