import { router } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptionCard } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Brand, Button, Screen } from '../components/ui';
import { accountName, useAuth } from '../lib/auth';
import { useSchool } from '../lib/school';
import { supabase } from '../lib/supabase';

/** "Who are you?", shown right after sign-up to anyone who isn't part of a school yet. */
export default function Welcome() {
  const { session } = useAuth();
  const { isOwner } = useSchool();
  const firstName = accountName(session).split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand subtitle={firstName ? `Welcome, ${firstName}` : 'Welcome'} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: space.md }}>Who are you?</Text>
        <OptionCard
          icon="ribbon-outline"
          title="Head of school"
          text="Principal or vice-principal academic."
          onPress={() => router.push('/join/head')}
        />
        <OptionCard
          icon="people-outline"
          title="Staff"
          text="Head of department or teacher."
          onPress={() => router.push('/join/staff')}
        />
        <OptionCard
          icon="school-outline"
          title="Student"
          text="See your results and class timetable."
          onPress={() => router.push('/student/join')}
        />
        {isOwner ? (
          <OptionCard icon="globe-outline" title="Zelvo owner dashboard" text="Every school using Zelvo, at a glance." onPress={() => router.push('/owner')} />
        ) : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.lg }} />
      </Screen>
    </SafeAreaView>
  );
}
