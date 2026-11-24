import AsyncStorage from '@react-native-async-storage/async-storage';
import { must, supabase } from '../supabase';

/** What the scanner needs to know about an exam. Saved on the phone so scanning also works offline. */
export type ScanExam = {
  id: string;
  schoolId: string;
  title: string;
  className: string;
  questionCount: number;
  optionCount: number;
  answerKey: string;
  markPerQuestion: number;
  students: { id: string; name: string }[];
  /** Students who already have a script for this exam. */
  scannedStudentIds: string[];
};

const cacheKey = (id: string) => `zelvo.scanExam.${id}`;

export async function loadScanExam(examId: string): Promise<ScanExam & { offline: boolean }> {
  try {
    const exam = must(
      await supabase
        .from('exams')
        .select('id, school_id, title, question_count, option_count, answer_key, mark_per_question, class_id, classes(name)')
        .eq('id', examId)
        .single(),
    );
    const [students, scripts] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('class_id', exam.class_id).order('full_name').then(must),
      supabase.from('scripts').select('student_id').eq('exam_id', examId).then(must),
    ]);
    const data: ScanExam = {
      id: exam.id,
      schoolId: exam.school_id,
      title: exam.title,
      className: exam.classes?.name ?? '',
      questionCount: exam.question_count,
      optionCount: exam.option_count,
      answerKey: exam.answer_key,
      markPerQuestion: Number(exam.mark_per_question),
      students: students.map((s) => ({ id: s.id, name: s.full_name })),
      scannedStudentIds: scripts.map((s) => s.student_id).filter((v): v is string => !!v),
    };
    await AsyncStorage.setItem(cacheKey(examId), JSON.stringify(data));
    return { ...data, offline: false };
  } catch (e) {
    const cached = await AsyncStorage.getItem(cacheKey(examId));
    if (cached) return { ...(JSON.parse(cached) as ScanExam), offline: true };
    throw e;
  }
}
