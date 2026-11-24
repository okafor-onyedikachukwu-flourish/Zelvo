import { router } from 'expo-router';
import { OptionCard } from '../../components/AuthParts';
import { Screen } from '../../components/ui';

/** Staff: head of department or teacher. */
export default function JoinStaff() {
  return (
    <Screen>
      <OptionCard
        icon="git-network-outline"
        title="Head of department"
        text="You'll choose your department next. You see its results in every class."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'hod' } })}
      />
      <OptionCard
        icon="person-outline"
        title="Teacher"
        text="You'll choose the subjects you teach next."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'teacher' } })}
      />
    </Screen>
  );
}
