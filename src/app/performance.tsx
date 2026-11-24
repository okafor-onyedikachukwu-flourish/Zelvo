import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../components/theme';
import { Badge, Card, EmptyState, ErrorView, Group, ListRow, LoadingView, Screen, SectionTitle } from '../components/ui';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';

type Row = Awaited<ReturnType<typeof load>>[number];

async function load(schoolId: string) {
  return must(await supabase.rpc('exam_performance', { p_school: schoolId }));
}

/** Average across exams, weighted by how many scripts each exam has. */
function weighted(rows: Row[]) {
  let total = 0;
  let n = 0;
  for (const r of rows) {
    if (r.average === null || r.scripts === 0) continue;
    total += Number(r.average) * r.scripts;
    n += r.scripts;
  }
  return n ? Math.round((total / n) * 10) / 10 : null;
}

const tone = (v: number | null) => (v === null ? 'neutral' : v >= 50 ? 'success' : 'warning');

export default function Performance() {
  const { schoolId, isAdmin, isHod } = useCurrentSchool();
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => load(schoolId), schoolId);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const rows = data ?? [];
  const classes = [...new Set(rows.map((r) => r.class_name))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const overall = weighted(rows);
  const scripts = rows.reduce((n, r) => n + r.scripts, 0);
  const scope = isAdmin ? 'Every class and subject' : isHod ? `${rows[0]?.subject_name ?? 'Your subject'} in every class` : 'Your exams';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Card style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, color: colors.muted }}>{scope}</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{overall === null ? '–' : `${overall}%`}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          Average score · {rows.length} {rows.length === 1 ? 'exam' : 'exams'} · {scripts} {scripts === 1 ? 'script' : 'scripts'}
        </Text>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Nothing to show yet" text="Results appear here once scripts have been scanned." />
      ) : (
        classes.map((cls) => {
          const classRows = rows.filter((r) => r.class_name === cls);
          const subjects = [...new Set(classRows.map((r) => r.subject_name))].sort();
          const avg = weighted(classRows);
          return (
            <View key={cls}>
              <SectionTitle right={<Badge label={avg === null ? 'No scores' : `${avg}%`} tone={tone(avg)} />}>{cls}</SectionTitle>
              <Group>
                {subjects.map((sub) => {
                  const subRows = classRows.filter((r) => r.subject_name === sub);
                  const subAvg = weighted(subRows);
                  const latest = subRows[subRows.length - 1];
                  const best = Math.max(...subRows.map((r) => Number(r.highest ?? 0)));
                  const worst = Math.min(...subRows.filter((r) => r.lowest !== null).map((r) => Number(r.lowest)));
                  return (
                    <ListRow
                      key={sub}
                      icon="book-outline"
                      title={sub}
                      subtitle={`${subRows.length} ${subRows.length === 1 ? 'exam' : 'exams'}${
                        Number.isFinite(worst) ? ` · highest ${best}% · lowest ${worst}%` : ''
                      } · latest: ${latest.title}`}
                      right={<Badge label={subAvg === null ? '–' : `${subAvg}%`} tone={tone(subAvg)} />}
                      onPress={() => router.push({ pathname: '/exams/[id]/results', params: { id: latest.exam_id } })}
                    />
                  );
                })}
              </Group>
            </View>
          );
        })
      )}
    </Screen>
  );
}
