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

async function loadSubjects(schoolId: string) {
  const [subjects, hods] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase.from('staff').select('id, full_name, subject_id').eq('school_id', schoolId).eq('role', 'hod').then(must),
  ]);
  return { subjects, hods };
}

/**
 * Role chips, plus the subject when the person is a head of department.
 * Each subject has only one head of department, so subjects taken by someone else can't be picked.
 */
export function RolePicker({
  role,
  subjectId,
  staffId,
  onChange,
}: {
  role: Role;
  subjectId: string | null;
  /** The person being edited, so their own subject doesn't count as taken. */
  staffId?: string;
  onChange: (role: Role, subjectId: string | null) => void;
}) {
  const { schoolId } = useCurrentSchool();
  const { data } = useLoad(() => loadSubjects(schoolId), schoolId);
  const subjects = data?.subjects;
  const takenBy = new Map((data?.hods ?? []).filter((h) => h.id !== staffId && h.subject_id).map((h) => [h.subject_id!, h.full_name]));
  const taken = (subjects ?? []).filter((s) => takenBy.has(s.id));

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
        <Field label="Their subject" hint="They'll see this subject's results in every class. Each subject has one head of department.">
          {subjects && subjects.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {subjects.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    selected={subjectId === s.id}
                    disabled={takenBy.has(s.id)}
                    onPress={() => onChange('hod', s.id)}
                  />
                ))}
              </View>
              {taken.length > 0 ? (
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
                  {'Already taken: ' + taken.map((s) => `${s.name} (${takenBy.get(s.id)})`).join(', ') + '. To change, make that person a teacher first.'}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ fontSize: 14, color: colors.warning }}>Add the school&apos;s subjects first (School → Subjects).</Text>
          )}
        </Field>
      ) : null}
    </>
  );
}
