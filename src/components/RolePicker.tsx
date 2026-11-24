import { Text, View } from 'react-native';
import { useCurrentSchool } from '../lib/school';
import { must, supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { colors, space } from './theme';
import { Chip, Field } from './ui';

/** What a member of staff does at the school (the principal isn't changed here). */
export type Position = 'teacher' | 'hod' | 'vp_academic';

/** Most heads a department can have in one school (the database enforces the same). */
export const MAX_HODS_PER_DEPARTMENT = 2;

const HINTS: Record<Position, string> = {
  teacher: 'Creates exams, prints answer sheets and scans scripts.',
  hod: 'A teacher who also sees their department’s results in every class, and enters the timetable.',
  vp_academic: 'A head of school: adds departments and subjects, approves staff, sees every class and exam.',
};

async function loadOptions(schoolId: string) {
  const [subjects, staff] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name').then(must),
    supabase.from('staff').select('id, full_name, role, head_title, subject_id').eq('school_id', schoolId).then(must),
  ]);
  return { subjects, staff };
}

/** Position chips, plus the department when the person is a head of department. */
export function RolePicker({
  position,
  subjectId,
  staffId,
  onChange,
}: {
  position: Position;
  subjectId: string | null;
  /** The person being edited, so they don't count against the limits. */
  staffId: string;
  onChange: (position: Position, subjectId: string | null) => void;
}) {
  const { schoolId } = useCurrentSchool();
  const { data } = useLoad(() => loadOptions(schoolId), schoolId);
  const others = (data?.staff ?? []).filter((s) => s.id !== staffId);
  const vp = others.find((s) => s.head_title === 'vp_academic');
  const hodsOf = new Map<string, string[]>();
  for (const s of others) {
    if (s.role !== 'hod' || !s.subject_id) continue;
    hodsOf.set(s.subject_id, [...(hodsOf.get(s.subject_id) ?? []), s.full_name]);
  }
  const isFull = (id: string) => (hodsOf.get(id)?.length ?? 0) >= MAX_HODS_PER_DEPARTMENT;
  const subjects = data?.subjects;

  return (
    <>
      <Field label="Position" hint={vp && position !== 'vp_academic' ? `${HINTS[position]} (Vice-principal academic: ${vp.full_name})` : HINTS[position]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Teacher" selected={position === 'teacher'} onPress={() => onChange('teacher', null)} />
          <Chip label="Head of department" selected={position === 'hod'} onPress={() => onChange('hod', subjectId)} />
          <Chip
            label="Vice-principal academic"
            selected={position === 'vp_academic'}
            disabled={!!vp}
            onPress={() => onChange('vp_academic', null)}
          />
        </View>
      </Field>
      {position === 'hod' ? (
        <Field label="Department" hint={`They see this department's results in every class. Up to ${MAX_HODS_PER_DEPARTMENT} heads per department.`}>
          {subjects && subjects.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {subjects.map((s) => (
                <Chip
                  key={s.id}
                  label={isFull(s.id) ? `${s.name} (full)` : s.name}
                  selected={subjectId === s.id}
                  disabled={isFull(s.id)}
                  onPress={() => onChange('hod', s.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: colors.warning }}>Add the school&apos;s departments first (School → Departments).</Text>
          )}
        </Field>
      ) : null}
    </>
  );
}
