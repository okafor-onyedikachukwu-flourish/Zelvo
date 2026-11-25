import { Linking, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../components/theme';
import { Banner, Brand, Button, Group, ListRow, Screen, SectionTitle } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/config';
import { useSchool } from '../lib/school';
import { supabase } from '../lib/supabase';

/** Shown to staff of a school the owner of Zelvo has suspended. */
export default function SchoolSuspended() {
  const { current, memberships, switchSchool } = useSchool();
  const others = memberships.filter((m) => m.school.id !== current?.school.id && !m.school.suspended_at);
  const reason = current?.school.suspended_reason;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand />
        <Banner
          tone="warning"
          icon="pause-circle-outline"
          title={`${current?.school.name ?? 'This school'} is paused on Zelvo`}
          text={`${reason ? `Reason: ${reason}. ` : ''}Its timetable, exams and results can't be opened for now. Nothing has been deleted.`}
        />
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: space.lg }}>
          If you think this is a mistake, email the Zelvo team and we&apos;ll look into it.
        </Text>
        <Button
          icon="mail-outline"
          title="Email the Zelvo team"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`About ${current?.school.name ?? 'my school'}`)}`)}
        />
        {others.length > 0 ? (
          <>
            <SectionTitle>Your other schools</SectionTitle>
            <Group>
              {others.map((m) => (
                <ListRow key={m.school.id} icon="business-outline" title={m.school.name} onPress={() => switchSchool(m.school.id)} />
              ))}
            </Group>
          </>
        ) : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.xl }} />
      </Screen>
    </SafeAreaView>
  );
}
