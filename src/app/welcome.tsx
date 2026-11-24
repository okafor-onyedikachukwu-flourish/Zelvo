import { router } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptionCard as Option } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Brand, Button, Screen } from '../components/ui';
import { accountName, useAuth } from '../lib/auth';
import { useSchool } from '../lib/school';
import { takeIntent } from '../lib/signup';
import { supabase } from '../lib/supabase';

export default function Welcome() {
  const { session } = useAuth();
  const { isOwner } = useSchool();
  const firstName = accountName(session).split(' ')[0];

  // Just signed up after choosing "I'm setting up a school" or "I'm a student": go straight there.
  useEffect(() => {
    const intent = takeIntent();
    if (intent === 'school') router.push('/create-school');
    else if (intent === 'student') router.push('/student/join');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand subtitle={firstName ? `Welcome, ${firstName}` : 'Welcome'} />
        <Option
          icon="business-outline"
          title="Set up a school"
          text="For the head of school. Teaching on your own? Set one up just for yourself."
          onPress={() => router.push('/create-school')}
        />
        <Option
          icon="key-outline"
          title="I'm a teacher with a code"
          text="Your head of school gives each member of staff their own 8-character code."
          onPress={() => router.push('/join-school')}
        />
        <Option
          icon="school-outline"
          title="I'm a student"
          text="Use the code your teacher emailed you, or find your school and class and ask to join."
          onPress={() => router.push('/student/join')}
        />
        {isOwner ? (
          <Option icon="globe-outline" title="Zelvo owner dashboard" text="Every school using Zelvo, at a glance." onPress={() => router.push('/owner')} />
        ) : null}
        <Button variant="ghost" title="Log out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.lg }} />
      </Screen>
    </SafeAreaView>
  );
}
