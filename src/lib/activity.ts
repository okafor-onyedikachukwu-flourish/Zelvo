// Tells Zelvo (once a day) that this account used the app, and on which build.
// The owner's dashboard turns this into "active today / this week" and "who needs to update".
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { currentBuild } from './updates';

export async function recordDailyUse(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `zelvo.activity.${userId}`;
  try {
    if ((await AsyncStorage.getItem(key)) === `${today}:${currentBuild()}`) return;
    const { error } = await supabase.rpc('record_activity', { p_build: currentBuild() || null, p_platform: Platform.OS });
    if (!error) await AsyncStorage.setItem(key, `${today}:${currentBuild()}`);
  } catch {
    // Offline: try again next time the app opens.
  }
}
