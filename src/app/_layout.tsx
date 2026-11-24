import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../components/theme';
import { ErrorView, LoadingView } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { syncScans } from '../lib/scan/queue';
import { SchoolProvider, useSchool } from '../lib/school';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SchoolProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SchoolProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { loading, current, error, refresh, studentAccounts, isOwner } = useSchool();
  const userId = session?.user.id;

  // Send scans saved offline whenever the app opens or comes back to the front.
  useEffect(() => {
    if (!userId) return;
    syncScans().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncScans().catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId]);

  if (authLoading || (session && loading)) return <LoadingView />;
  if (session && !current && error) return <ErrorView message={error} onRetry={refresh} />;

  const signedIn = !!session;
  const hasSchool = signedIn && !!current;
  // Staff come first: an account that works at a school always sees the staff app.
  const isStudent = signedIn && !hasSchool && studentAccounts.some((a) => a.status === 'approved');
  const isWaiting = signedIn && !hasSchool && !isStudent && studentAccounts.length > 0;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="start" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
        <Stack.Screen name="code" options={{ title: 'Join with a code' }} />
      </Stack.Protected>

      {/* Open whether or not someone is logged in. */}
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot password' }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />

      <Stack.Protected guard={signedIn && !hasSchool && !isStudent && !isWaiting}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isWaiting}>
        <Stack.Screen name="student/waiting" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isStudent}>
        <Stack.Screen name="student/index" options={{ title: 'Zelvo' }} />
        <Stack.Screen name="student/result/[examId]" options={{ title: 'Result' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="create-school" options={{ title: 'Set up a school' }} />
        <Stack.Screen name="join-school" options={{ title: 'Join a school' }} />
        <Stack.Screen name="student/join" options={{ title: 'Join as a student' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && isOwner}>
        <Stack.Screen name="owner" options={{ title: 'Zelvo owner dashboard' }} />
      </Stack.Protected>

      <Stack.Protected guard={hasSchool}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="school-details" options={{ title: 'School details' }} />
        <Stack.Screen name="staff/index" options={{ title: 'Staff' }} />
        <Stack.Screen name="staff/add" options={{ title: 'Add staff', presentation: 'modal' }} />
        <Stack.Screen name="staff/[id]" options={{ title: 'Staff member' }} />
        <Stack.Screen name="classes/index" options={{ title: 'Classes' }} />
        <Stack.Screen name="classes/[id]" options={{ title: 'Class' }} />
        <Stack.Screen name="classes/import" options={{ title: 'Add students', presentation: 'modal' }} />
        <Stack.Screen name="students/[id]" options={{ title: 'Student' }} />
        <Stack.Screen name="subjects" options={{ title: 'Subjects' }} />
        <Stack.Screen name="student-requests" options={{ title: 'Student accounts' }} />
        <Stack.Screen name="performance" options={{ title: 'Performance' }} />
        <Stack.Screen name="exams/new" options={{ title: 'New exam', presentation: 'modal' }} />
        <Stack.Screen name="exams/[id]/index" options={{ title: 'Exam' }} />
        <Stack.Screen name="exams/[id]/edit" options={{ title: 'Edit exam' }} />
        <Stack.Screen name="exams/[id]/key" options={{ title: 'Answer key' }} />
        <Stack.Screen name="exams/[id]/sheets" options={{ title: 'Answer sheets' }} />
        <Stack.Screen name="exams/[id]/scan" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="exams/[id]/results" options={{ title: 'Results' }} />
        <Stack.Screen name="exams/[id]/script/[scriptId]" options={{ title: 'Script' }} />
      </Stack.Protected>
    </Stack>
  );
}
