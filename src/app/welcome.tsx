import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptionCard } from '../components/AuthParts';
import { PhotoCard } from '../components/Photo';
import { colors, space } from '../components/theme';
import { Button, Screen } from '../components/ui';
import { accountName, useAuth } from '../lib/auth';
import { PHOTOS } from '../lib/photos';
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 17 }}>Z</Text>
          </View>
          <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '500' }}>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</Text>
        </View>
        <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.text, letterSpacing: -0.6, marginTop: space.md, marginBottom: space.lg }}>
          Who are you?
        </Text>
        <PhotoCard photo={PHOTOS.head} title="Head of school" text="Principal or vice-principal academic" onPress={() => router.push('/join/head')} />
        <PhotoCard photo={PHOTOS.staff} tone="accent" title="Staff" text="Head of department or teacher" onPress={() => router.push('/join/staff')} />
        <PhotoCard photo={PHOTOS.student} tone="success" title="Student" text="See your results and timetable" onPress={() => router.push('/student/join')} />
        {isOwner ? (
          <OptionCard icon="globe-outline" title="Zelvo owner dashboard" text="Every school using Zelvo, at a glance." onPress={() => router.push('/owner')} />
        ) : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.sm }} />
      </Screen>
    </SafeAreaView>
  );
}
