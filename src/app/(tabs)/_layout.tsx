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
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
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
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Exams',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'document-text' : 'document-text-outline'} color={color as string} size={size} />,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/exams/new')}
              hitSlop={8}
              style={{ marginRight: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="New exam"
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="school"
        options={{
          title: 'School',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'business' : 'business-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
