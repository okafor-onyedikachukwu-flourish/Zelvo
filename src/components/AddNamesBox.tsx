import { useState } from 'react';
import { View } from 'react-native';
import { splitList } from '../lib/names';
import { space } from './theme';
import { Button, Input } from './ui';

/** Text box for adding one or several names at once ("JSS1A, JSS1B"). */
export function AddNamesBox({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (names: string[]) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const names = splitList(text);

  async function submit() {
    if (names.length === 0) return;
    setBusy(true);
    const ok = await onAdd(names);
    setBusy(false);
    if (ok) setText('');
  }

  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <Input
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        onSubmitEditing={submit}
        returnKeyType="done"
        style={{ flex: 1 }}
      />
      <Button
        title={names.length > 1 ? `Add ${names.length}` : 'Add'}
        onPress={submit}
        loading={busy}
        disabled={names.length === 0}
      />
    </View>
  );
}
