import { router } from 'expo-router';
import { PhotoCard } from '../../components/Photo';
import { Screen } from '../../components/ui';
import { PHOTOS } from '../../lib/photos';

/** Staff: head of department or teacher. */
export default function JoinStaff() {
  return (
    <Screen>
      <PhotoCard
        photo={PHOTOS.staff}
        photoHeight={96}
        tone="accent"
        title="Head of department"
        text="Choose your department next. You see its results in every class."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'hod' } })}
      />
      <PhotoCard
        photo={PHOTOS.start}
        photoHeight={96}
        title="Teacher"
        text="Choose the subjects you teach next."
        onPress={() => router.push({ pathname: '/join/school', params: { as: 'teacher' } })}
      />
    </Screen>
  );
}
