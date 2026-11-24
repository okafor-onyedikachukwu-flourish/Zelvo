import { router } from 'expo-router';
import { Text } from 'react-native';
import { OptionCard } from '../../components/AuthParts';
import { colors, space } from '../../components/theme';
import { Screen } from '../../components/ui';

/** Head of school: principal or vice-principal academic. */
export default function JoinHead() {
  return (
    <Screen>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: space.lg }}>Each school has one principal and one vice-principal academic.</Text>
      <OptionCard
        icon="business-outline"
        title="Principal"
        text="Set up your school in Zelvo. You approve your staff."
        onPress={() => router.push('/create-school')}
      />
      <OptionCard
        icon="library-outline"
        title="Vice-principal academic"
        text="Join your school. You add its departments and subjects, and approve staff."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'vp_academic' } })}
      />
    </Screen>
  );
}
