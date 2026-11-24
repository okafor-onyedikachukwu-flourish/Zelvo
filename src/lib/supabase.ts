import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import type { Database } from './database.types';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the log-in fresh only while the app is open.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

type Success<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never;

/** Returns the data of a Supabase response, or throws its error. */
export function must<R extends { data: unknown; error: unknown }>(res: R): Success<R> {
  if (res.error) throw res.error;
  return res.data as Success<R>;
}
