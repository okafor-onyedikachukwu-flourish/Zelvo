import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../lib/sheet/render';
import { colors, radius, space } from './theme';

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Optional date. `value` is "YYYY-MM-DD" or null. */
export function DateField({ value, onChange }: { value: string | null; onChange: (day: string | null) => void }) {
  const current = value ? fromKey(value) : new Date();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.box}>
        <DateTimePicker mode="date" display="compact" value={current} onChange={(_, d) => d && onChange(toKey(d))} />
        {value ? <Clear onPress={() => onChange(null)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Pressable
        style={styles.press}
        onPress={() =>
          DateTimePickerAndroid.open({
            mode: 'date',
            value: current,
            onChange: (e, d) => {
              if (e.type === 'set' && d) onChange(toKey(d));
            },
          })
        }
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={[styles.text, !value && { color: colors.faint }]}>{value ? formatDate(value) : 'No date'}</Text>
      </Pressable>
      {value ? <Clear onPress={() => onChange(null)} /> : null}
    </View>
  );
}

function Clear({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel="Remove date" style={{ padding: space.sm }}>
      <Ionicons name="close-circle" size={20} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingRight: space.xs,
  },
  press: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 12 },
  text: { fontSize: 16, color: colors.text },
});
