import { Text, View } from 'react-native';
import type { Role } from '../lib/school';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { colors, space } from './theme';
import { Chip, Field } from './ui';

const HINTS: Record<Role, string> = {
  teacher: 'Creates exams, prints answer sheets and scans scripts.',
  hod: 'A teacher who also sees results for their subject in every class, and enters the timetable.',
  admin: 'Sets up the school, adds staff and sees every class and exam.',
};

/** Role chips, plus the subject when the person is a head of department. */
export function RolePicker({
  role,
  subjectId,
  onChange,
}: {
  role: Role;
  subjectId: string | null;
  onChange: (role: Role, subjectId: string | null) => void;
}) {
  const { schoolId } = useCurrentSchool();
  const { data: subjects } = useLoad(
    async () => must(await supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name')),
    schoolId,
  );

  return (
    <>
      <Field label="Role" hint={HINTS[role]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Teacher" selected={role === 'teacher'} onPress={() => onChange('teacher', null)} />
          <Chip label="Head of department" selected={role === 'hod'} onPress={() => onChange('hod', subjectId)} />
          <Chip label="Head of school" selected={role === 'admin'} onPress={() => onChange('admin', null)} />
        </View>
      </Field>
      {role === 'hod' ? (
        <Field label="Their subject" hint="They'll see this subject's results in every class.">
          {subjects && subjects.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {subjects.map((s) => (
                <Chip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => onChange('hod', s.id)} />
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: colors.warning }}>Add the school&apos;s subjects first (School → Subjects).</Text>
          )}
        </Field>
      ) : null}
    </>
  );
}
