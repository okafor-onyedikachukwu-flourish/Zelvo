import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space } from '../components/theme';
import { Brand, Button, Screen, type IconName } from '../components/ui';
import { accountName, useAuth } from '../lib/auth';
import { useSchool } from '../lib/school';
import { supabase } from '../lib/supabase';

export default function Welcome() {
  const { session } = useAuth();
  const { isOwner } = useSchool();
  const firstName = accountName(session).split(' ')[0];

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
          text="Your school admin gives each teacher their own 8-character code."
          onPress={() => router.push('/join-school')}
        />
        <Option
          icon="school-outline"
          title="I'm a student"
          text="Find your school and class. A teacher approves you, then you can see your results."
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

function Option({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    marginBottom: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 14, color: colors.muted },
});
