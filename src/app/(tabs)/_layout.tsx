import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { Pressable } from 'react-native';
import { colors } from '../../components/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 20 },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Exams',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color as string} size={size} />,
          headerRight: () => (
            <Pressable onPress={() => router.push('/exams/new')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="New exam">
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="school"
        options={{
          title: 'School',
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
