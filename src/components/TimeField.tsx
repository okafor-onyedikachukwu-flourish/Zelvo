import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime, hhmm, minutes } from '../lib/timetable';
import { colors, radius, space } from './theme';

/** A time of day, "HH:MM". */
export function TimeField({ value, onChange, label }: { value: string; onChange: (time: string) => void; label?: string }) {
  const mins = minutes(value);
  const current = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  const pick = (d: Date) => onChange(hhmm(d.getHours() * 60 + d.getMinutes()));

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.box}>
        <DateTimePicker mode="time" display="compact" value={current} onChange={(_, d) => d && pick(d)} />
      </View>
    );
  }

  return (
    <Pressable
      style={styles.box}
      accessibilityRole="button"
      accessibilityLabel={`${label ?? 'Time'}: ${formatTime(value)}. Tap to change.`}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: 'time',
          value: current,
          onChange: (e, d) => {
            if (e.type === 'set' && d) pick(d);
          },
        })
      }
    >
      <Ionicons name="time-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>{formatTime(value)}</Text>
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
