import { router, useLocalSearchParams } from 'expo-router';
import { ExamForm } from '../../../components/ExamForm';
import { ErrorView, LoadingView, confirm } from '../../../components/ui';
import { keyProgress, resizeKey } from '../../../lib/exams';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

async function load(id: string) {
  return must(
    await supabase
      .from('exams')
      .select('id, title, class_id, subject_id, exam_date, question_count, option_count, mark_per_question, record_out_of, answer_key')
      .eq('id', id)
      .single(),
  );
}

export default function EditExam() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id), id);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const exam = data!;

  return (
    <ExamForm
      initial={{
        title: exam.title,
        classId: exam.class_id,
        subjectId: exam.subject_id,
        examDate: exam.exam_date,
        questionCount: exam.question_count,
        optionCount: exam.option_count,
        markPerQuestion: Number(exam.mark_per_question),
        recordOutOf: exam.record_out_of === null ? null : Number(exam.record_out_of),
      }}
      submitLabel="Save changes"
      note="If you've already printed answer sheets or scanned scripts, changing the number of questions or options means printing and scanning again."
      onSubmit={async (v) => {
        const newKey = resizeKey(exam.answer_key, v.questionCount, v.optionCount);
        const lost = keyProgress(exam.answer_key).set - keyProgress(newKey).set;
        if (lost > 0) {
          const ok = await confirm(
            'Some answers will be cleared',
            `${lost} ${lost === 1 ? 'answer' : 'answers'} in the key no longer fit the new number of questions or options.`,
            'Save anyway',
          );
          if (!ok) throw new Error('Not saved.');
        }
        must(
          await supabase
            .from('exams')
            .update({
              title: v.title,
              class_id: v.classId,
              subject_id: v.subjectId,
              exam_date: v.examDate,
              question_count: v.questionCount,
              option_count: v.optionCount,
              mark_per_question: v.markPerQuestion,
              record_out_of: v.recordOutOf,
              answer_key: newKey,
            })
            .eq('id', exam.id)
            .select('id')
            .single(),
        );
        router.back();
      }}
    />
  );
}
