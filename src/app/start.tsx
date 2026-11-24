import { router } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptionCard } from '../components/AuthParts';
import { colors, space } from '../components/theme';
import { Brand, Button, Screen } from '../components/ui';

/** The first screen for someone who isn't logged in: what are you here to do? */
export default function Start() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand subtitle="Exam marking and timetable alarms for schools" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space.md }}>How are you joining?</Text>
        <OptionCard
          icon="key-outline"
          title="I have a join code"
          text="Your head of school or teacher sent you an 8-character code, like AB3D-EF7H."
          onPress={() => router.push('/code')}
        />
        <OptionCard
          icon="business-outline"
          title="I'm setting up a school"
          text="For the head of school, or a teacher using Zelvo on their own."
          onPress={() => router.push({ pathname: '/sign-up', params: { intent: 'school' } })}
        />
        <OptionCard
          icon="school-outline"
          title="I'm a student without a code"
          text="Find your school and class, and a teacher approves you."
          onPress={() => router.push({ pathname: '/sign-up', params: { intent: 'student' } })}
        />
        <Button variant="ghost" title="I already have an account. Log in" onPress={() => router.push('/sign-in')} style={{ marginTop: space.md }} />
      </Screen>
    </SafeAreaView>
  );
}
