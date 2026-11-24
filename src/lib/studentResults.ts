import { must, supabase } from './supabase';

/** The signed-in student's released results (with the answer key, to show what they got wrong). */
export async function loadMyResults() {
  return must(await supabase.rpc('my_results'));
}
