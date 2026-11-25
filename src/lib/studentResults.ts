import { must, supabase } from './supabase';

/** The signed-in student's released results (with the answer key, to show what they got wrong). */
export async function loadMyResults() {
  return must(await supabase.rpc('my_results'));
}

/** The student's class timetable (lessons only), for every class they've joined. */
export async function loadMyTimetable() {
  return must(await supabase.rpc('my_timetable'));
}

/** The exam papers my class writes (current and coming exams, and the last two weeks). */
export async function loadMyExams() {
  return must(await supabase.rpc('my_exam_papers'));
}
