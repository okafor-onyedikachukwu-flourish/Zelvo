import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../components/theme';
import { Brand, Button, Screen, type IconName } from '../components/ui';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'scan-outline', text: 'Mark exam scripts with your phone camera' },
  { icon: 'bar-chart-outline', text: 'See results class by class' },
  { icon: 'alarm-outline', text: 'Timetable alarms so you never miss a lesson' },
];

/** The first screen for someone who isn't logged in. */
export default function Start() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Brand subtitle="Exam marking and timetable alarms for schools" />
        <View style={{ gap: space.md, marginVertical: space.lg }}>
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name={p.icon} size={24} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{p.text}</Text>
            </View>
          ))}
        </View>
        <Button title="Create an account" icon="person-add-outline" onPress={() => router.push('/sign-up')} />
        <Button
          variant="ghost"
          title="I already have an account. Log in"
          onPress={() => router.push('/sign-in')}
          style={{ marginTop: space.sm }}
        />
      </Screen>
    </SafeAreaView>
  );
}
