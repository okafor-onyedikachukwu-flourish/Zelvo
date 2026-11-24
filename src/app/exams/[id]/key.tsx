import { Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../../components/theme';
import { Banner, Button, ErrorView, Input, LoadingView } from '../../../components/ui';
import { FREE, UNSET, keyProgress, lettersFor, parseTypedKey } from '../../../lib/exams';
import { friendlyError } from '../../../lib/errors';
import { must, supabase } from '../../../lib/supabase';
import { useLoad } from '../../../lib/useLoad';

const ROW_HEIGHT = 56;

async function load(id: string) {
  return must(await supabase.from('exams').select('id, title, option_count, answer_key').eq('id', id).single());
}

export default function AnswerKeyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(() => load(id), id);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  return <KeyEditor key={data!.id} examId={data!.id} optionCount={data!.option_count} initialKey={data!.answer_key} />;
}

type SaveState = 'saved' | 'waiting' | 'saving' | 'error';

function KeyEditor({ examId, optionCount, initialKey }: { examId: string; optionCount: number; initialKey: string }) {
  const [key, setKey] = useState(initialKey);
  const [savedKey, setSavedKey] = useState(initialKey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const savedRef = useRef(initialKey);
  const latestRef = useRef(initialKey);
  const mounted = useRef(true);
  const letters = lettersFor(optionCount);

  const save = useCallback(
    async (value: string) => {
      if (value === savedRef.current) return;
      if (mounted.current) setSaving(true);
      try {
        must(await supabase.from('exams').update({ answer_key: value }).eq('id', examId).select('id').single());
        savedRef.current = value;
        if (mounted.current) {
          setSavedKey(value);
          setSaveError(null);
        }
      } catch (e) {
        if (mounted.current) setSaveError(friendlyError(e));
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [examId],
  );

  // Save shortly after the last change, and once more when leaving the screen.
  useEffect(() => {
    latestRef.current = key;
    if (key === savedRef.current) return;
    const t = setTimeout(() => save(key), 700);
    return () => clearTimeout(t);
  }, [key, save]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (latestRef.current !== savedRef.current) save(latestRef.current);
    };
  }, [save]);

  const choose = useCallback((index: number, ch: string) => {
    setKey((k) => {
      const next = k[index] === ch ? UNSET : ch;
      return k.slice(0, index) + next + k.slice(index + 1);
    });
  }, []);

  const parsed = parseTypedKey(typed, optionCount);
  function applyTyped() {
    if (!parsed) return;
    setKey((k) => (parsed + k.slice(parsed.length)).slice(0, k.length));
    setTyped('');
    setTyping(false);
  }

  const state: SaveState = saving ? 'saving' : saveError ? 'error' : key === savedKey ? 'saved' : 'waiting';
  const { set, total } = keyProgress(key);
  const items = Array.from({ length: key.length }, (_, i) => i);

  return (
    <>
      <Stack.Screen options={{ title: 'Answer key', headerRight: () => <SaveStatus state={state} /> }} />
      <FlatList
        data={items}
        keyExtractor={(i) => String(i)}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={20}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48 }}
        ListHeaderComponent={
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            {saveError ? (
              <Banner
                tone="danger"
                icon="cloud-offline-outline"
                title="Not saved yet"
                text={saveError}
                action={<Button small title="Try again" onPress={() => save(latestRef.current)} />}
              />
            ) : null}
            <Text style={styles.progress}>
              {set} of {total} answers set
            </Text>
            <Text style={styles.help}>
              Tap the correct option for each question. Tap it again to clear it. Use ✱ to give everyone the mark for a question (for
              example, if it had a mistake).
            </Text>
            {typing ? (
              <View style={{ marginTop: space.md, gap: space.sm }}>
                <Input
                  value={typed}
                  onChangeText={setTyped}
                  placeholder={'e.g. ABDC CADB BBAC…\nor 1A 2C 3B…'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  multiline
                  style={{ minHeight: 90, textAlignVertical: 'top' }}
                  autoFocus
                />
                <Text style={styles.help}>
                  {parsed.length > 0
                    ? `${Math.min(parsed.length, total)} answers read, filling questions 1–${Math.min(parsed.length, total)}.`
                    : 'Type or paste the answers in order. Numbers, spaces and commas are ignored.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button small title="Use these answers" onPress={applyTyped} disabled={parsed.length === 0} />
                  <Button small variant="ghost" title="Cancel" onPress={() => setTyping(false)} />
                </View>
              </View>
            ) : (
              <Button
                small
                variant="secondary"
                icon="create-outline"
                title="Type or paste the whole key"
                onPress={() => setTyping(true)}
                style={{ alignSelf: 'flex-start', marginTop: space.md }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => <KeyRow index={item} value={key[item]} letters={letters} onChoose={choose} />}
      />
    </>
  );
}

const KeyRow = memo(function KeyRow({
  index,
  value,
  letters,
  onChoose,
}: {
  index: number;
  value: string;
  letters: string[];
  onChoose: (index: number, ch: string) => void;
}) {
  return (
    <View style={[styles.row, index % 10 === 9 && styles.rowGap]}>
      <Text style={[styles.number, value === UNSET && { color: colors.faint }]}>{index + 1}</Text>
      {letters.map((l) => (
        <Pressable
          key={l}
          onPress={() => onChoose(index, l)}
          accessibilityLabel={`Question ${index + 1}, option ${l}`}
          style={[styles.bubble, value === l && styles.bubbleOn]}
        >
          <Text style={[styles.bubbleText, value === l && styles.bubbleTextOn]}>{l}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => onChoose(index, FREE)}
        accessibilityLabel={`Question ${index + 1}, free mark for everyone`}
        style={[styles.bubble, styles.free, value === FREE && styles.freeOn]}
      >
        <Text style={[styles.bubbleText, { color: value === FREE ? '#fff' : colors.warning }]}>✱</Text>
      </Pressable>
    </View>
  );
});

function SaveStatus({ state }: { state: SaveState }) {
  const label = { saved: 'Saved', waiting: 'Saving…', saving: 'Saving…', error: 'Not saved' }[state];
  const color = state === 'error' ? colors.danger : state === 'saved' ? colors.success : colors.muted;
  return <Text style={{ color, fontSize: 14, fontWeight: '600' }}>{label}</Text>;
}

const styles = StyleSheet.create({
  progress: { fontSize: 18, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, color: colors.muted, marginTop: 4 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  rowGap: { borderBottomWidth: 1, borderBottomColor: colors.border },
  number: { width: 36, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'right', marginRight: space.xs },
  bubble: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  bubbleText: { fontSize: 16, fontWeight: '700', color: colors.muted },
  bubbleTextOn: { color: '#fff' },
  free: { marginLeft: space.xs, borderRadius: radius.sm, borderColor: colors.warningSoft },
  freeOn: { backgroundColor: colors.warning, borderColor: colors.warning },
});
