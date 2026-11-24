import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
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
