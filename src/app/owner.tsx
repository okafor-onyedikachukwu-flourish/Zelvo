import { Text, View } from 'react-native';
import { colors, space } from '../components/theme';
import { Card, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../components/ui';
import { formatDate } from '../lib/sheet/render';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';

async function load() {
  return must(await supabase.rpc('platform_overview'));
}

export default function OwnerDashboard() {
  const { data, loading, error, reload, refresh, refreshing } = useLoad(load, 'owner');
  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const schools = data ?? [];
  const sum = (k: 'staff_joined' | 'students' | 'student_accounts' | 'exams' | 'scripts') => schools.reduce((n, s) => n + s[k], 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Card>
        <Text style={{ fontSize: 14, color: colors.muted }}>All schools using Zelvo</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.sm }}>
          <Stat label="Schools" value={schools.length} />
          <Stat label="Staff" value={sum('staff_joined')} />
          <Stat label="Students listed" value={sum('students')} />
          <Stat label="Student accounts" value={sum('student_accounts')} />
          <Stat label="Exams" value={sum('exams')} />
          <Stat label="Scripts marked" value={sum('scripts')} />
        </View>
      </Card>
      <Text style={{ fontSize: 12, color: colors.muted, marginTop: space.sm }}>
        Counts only. Scores, answer keys and names stay private to each school.
      </Text>

      <SectionTitle>Schools</SectionTitle>
      {schools.length === 0 ? (
        <EmptyState icon="business-outline" title="No schools yet" text="Schools appear here as soon as they're set up." />
      ) : (
        <Group>
          {schools.map((s) => (
            <ListRow
              key={s.school_id}
              icon="business-outline"
              title={s.name}
              subtitle={`${[s.country, `since ${formatDate(s.created_at.slice(0, 10))}`].filter(Boolean).join(' · ')}\n${s.staff_joined} staff · ${s.students} students · ${s.exams} exams · ${s.scripts} scripts`}
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ minWidth: 90 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}
