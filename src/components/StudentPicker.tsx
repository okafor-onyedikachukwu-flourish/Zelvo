import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from './theme';
import { Button, Input } from './ui';

export type PickedStudent = { studentId: string | null; name: string | null };

/** Full-screen list for choosing whose script this is. */
export function StudentPicker({
  visible,
  title,
  subtitle,
  students,
  taken,
  laterLabel = 'Name it later',
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  students: { id: string; name: string }[];
  /** Students who already have a script for this exam (shown with a note). */
  taken?: Set<string>;
  laterLabel?: string;
  onPick: (picked: PickedStudent) => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
  const exact = students.some((s) => s.name.toLowerCase() === q);

  const pick = (p: PickedStudent) => {
    setQuery('');
    onPick(p);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose ?? (() => pick({ studentId: null, name: null }))}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 14, color: colors.muted }}>{subtitle}</Text> : null}
          <Input value={query} onChangeText={setQuery} placeholder={students.length ? 'Search or type a name' : 'Type the student’s name'} autoFocus={students.length === 0} />
          {q.length >= 2 && !exact ? (
            <Button
              small
              variant="secondary"
              icon="person-add-outline"
              title={`Use “${query.trim()}”`}
              onPress={() => pick({ studentId: null, name: query.trim().replace(/\s+/g, ' ') })}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </View>
        <FlatList
          data={shown}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => pick({ studentId: item.id, name: item.name })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {taken?.has(item.id) ? <Text style={styles.note}>Already scanned: this page will be added to their script</Text> : null}
              </View>
            </Pressable>
          )}
        />
        <View style={{ padding: space.lg }}>
          <Button variant="ghost" title={laterLabel} onPress={() => pick({ studentId: null, name: null })} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, backgroundColor: colors.bg },
  name: { fontSize: 16, color: colors.text, fontWeight: '600' },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
