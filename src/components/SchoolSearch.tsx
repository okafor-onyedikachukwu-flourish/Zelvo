import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, space } from './theme';
import { Button, Group, Input, ListRow } from './ui';

export type FoundSchool = { id: string; name: string; country: string | null };

/** Type a school's name and pick it; once picked, shows it with a Change button. */
export function SchoolSearch({ school, onChange }: { school: FoundSchool | null; onChange: (s: FoundSchool | null) => void }) {
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState<FoundSchool[]>([]);

  // Search as the person types.
  useEffect(() => {
    if (school || query.trim().length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('find_schools', { p_query: query.trim() });
      if (active) setSchools(data ?? []);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, school]);

  if (school) {
    return (
      <Group>
        <ListRow
          icon="business-outline"
          title={school.name}
          subtitle={school.country ?? undefined}
          right={<Button small variant="ghost" title="Change" onPress={() => onChange(null)} />}
        />
      </Group>
    );
  }

  return (
    <>
      <Input value={query} onChangeText={setQuery} placeholder="Type your school's name" autoFocus />
      {query.trim().length >= 2 ? (
        schools.length > 0 ? (
          <View style={{ marginTop: space.sm }}>
            <Group>
              {schools.map((s) => (
                <ListRow key={s.id} icon="business-outline" title={s.name} subtitle={s.country ?? undefined} onPress={() => onChange(s)} />
              ))}
            </Group>
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: space.sm }}>
            No school found. Check the spelling, or ask whether your principal has set up the school in Zelvo yet.
          </Text>
        )
      ) : null}
    </>
  );
}
