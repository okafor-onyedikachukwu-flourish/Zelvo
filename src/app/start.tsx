import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo, Photo, useLightStatusBar } from '../components/Photo';
import { colors, space } from '../components/theme';
import { Button, type IconName } from '../components/ui';
import { PHOTOS } from '../lib/photos';

const POINTS: { icon: IconName; text: string; bg: string; fg: string }[] = [
  { icon: 'scan-outline', text: 'Scan scripts with your phone camera', bg: colors.accentSoft, fg: colors.accentText },
  { icon: 'bar-chart-outline', text: 'See results class by class', bg: colors.primarySoft, fg: colors.primary },
  { icon: 'alarm-outline', text: 'Timetable alarms for every lesson', bg: colors.successSoft, fg: colors.success },
];

/** The first screen for someone who isn't logged in. */
export default function Start() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.card }} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <Photo photo={PHOTOS.start} width={420} scrim style={{ height: 460 + insets.top }}>
        <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top + space.lg, paddingHorizontal: space.xl, paddingBottom: 56 }}>
          <Logo light />
          <View style={{ gap: space.md }}>
            <Text style={{ fontSize: 31, lineHeight: 37, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6 }}>
              Mark exams in minutes. Never miss a lesson.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 23, color: '#E4E2FF' }}>Exam marking and timetable alarms for every school.</Text>
          </View>
        </View>
      </Photo>

      <View
        style={{
          flex: 1,
          marginTop: -28,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: colors.card,
          paddingTop: 28,
          paddingHorizontal: space.xl,
          paddingBottom: insets.bottom + space.lg,
          gap: space.xl,
        }}
      >
        <View style={{ gap: 14 }}>
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={p.icon} size={22} color={p.fg} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text }}>{p.text}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 'auto', gap: space.xs }}>
          <Button title="Create an account" onPress={() => router.push('/sign-up')} />
          <Button variant="ghost" title="I already have an account · Log in" onPress={() => router.push('/sign-in')} />
          <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: space.xs }}>Photo: {PHOTOS.start.by} on Unsplash</Text>
        </View>
      </View>
    </ScrollView>
  );
}
