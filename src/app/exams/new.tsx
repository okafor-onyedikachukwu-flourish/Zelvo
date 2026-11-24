import { router } from 'expo-router';
import { ExamForm } from '../../components/ExamForm';
import { UNSET } from '../../lib/exams';
import { useCurrentSchool } from '../../lib/school';
import { must, supabase } from '../../lib/supabase';

export default function NewExam() {
  const { schoolId } = useCurrentSchool();
  return (
    <ExamForm
      submitLabel="Create exam"
      onSubmit={async (v) => {
        const exam = must(
          await supabase
            .from('exams')
            .insert({
              school_id: schoolId,
              class_id: v.classId,
              subject_id: v.subjectId,
              title: v.title,
              exam_date: v.examDate,
              question_count: v.questionCount,
              option_count: v.optionCount,
              mark_per_question: v.markPerQuestion,
              record_out_of: v.recordOutOf,
              answer_key: UNSET.repeat(v.questionCount),
            })
            .select('id')
            .single(),
        );
        router.replace({ pathname: '/exams/[id]', params: { id: exam.id } });
      }}
    />
  );
}
