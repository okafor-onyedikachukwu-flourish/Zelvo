import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { isoDate } from '../lib/alarms';
import { dateLabel, toDate } from '../lib/examTimetable';
import { colors, radius, space } from './theme';

/** A date that must be set, "2026-12-01" (DateField is the optional kind). */
export function CalendarField({
  value,
  onChange,
  label,
  min,
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  min?: string;
}) {
  const current = toDate(value);
  const minimumDate = min ? toDate(min) : undefined;

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.box}>
        <DateTimePicker mode="date" display="compact" value={current} minimumDate={minimumDate} onChange={(_, d) => d && onChange(isoDate(d))} />
      </View>
    );
  }

  return (
    <Pressable
      style={styles.box}
      accessibilityRole="button"
      accessibilityLabel={`${label ?? 'Date'}: ${dateLabel(value, true)}. Tap to change.`}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: 'date',
          value: current,
          minimumDate,
          onChange: (e, d) => {
            if (e.type === 'set' && d) onChange(isoDate(d));
          },
        })
      }
    >
      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>{dateLabel(value)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  text: { fontSize: 16, color: colors.text, fontWeight: '600' },
});
