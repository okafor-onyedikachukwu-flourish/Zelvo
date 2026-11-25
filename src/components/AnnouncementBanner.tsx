import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Banner, Button } from './ui';

const KEY = 'zelvo.dismissedAnnouncements';
type Announcement = { id: string; title: string; body: string };

/** The newest message from the Zelvo team, until the person dismisses it. */
export function AnnouncementBanner() {
  const [item, setItem] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, ends_at, stopped_at')
        .is('stopped_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      const dismissed: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
      const live = (data ?? []).find((a) => !dismissed.includes(a.id) && (!a.ends_at || new Date(a.ends_at) > new Date()));
      if (active) setItem(live ?? null);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!item) return null;

  async function dismiss() {
    const id = item!.id;
    setItem(null);
    const dismissed: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    await AsyncStorage.setItem(KEY, JSON.stringify([...dismissed, id].slice(-50)));
  }

  return (
    <Banner
      tone="info"
      icon="megaphone-outline"
      title={item.title}
      text={item.body || undefined}
      action={<Button small variant="secondary" title="Got it" onPress={dismiss} />}
    />
  );
}
