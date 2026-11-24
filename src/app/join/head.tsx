import { router } from 'expo-router';
import { Text } from 'react-native';
import { PhotoCard } from '../../components/Photo';
import { colors, space } from '../../components/theme';
import { Screen } from '../../components/ui';
import { PHOTOS } from '../../lib/photos';

/** Head of school: principal or vice-principal academic. */
export default function JoinHead() {
  return (
    <Screen>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: space.lg }}>Each school has one principal and one vice-principal academic.</Text>
      <PhotoCard
        photo={PHOTOS.head}
        photoHeight={96}
        title="Principal"
        text="Set up your school in Zelvo. You approve your staff."
        onPress={() => router.push('/create-school')}
      />
      <PhotoCard
        photo={PHOTOS.pencils}
        photoHeight={96}
        tone="accent"
        title="Vice-principal academic"
        text="Join your school. You add departments and approve staff."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'vp_academic' } })}
      />
    </Screen>
  );
}
