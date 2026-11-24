import { Input } from './ui';
import { formatCode } from '../lib/invites';

/** Keeps only letters and numbers, at most 8. */
export function cleanCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/** Big 8-character code box that shows the code as AB3D-EF7H while typing. */
export function CodeInput({ value, onChange, onSubmit }: { value: string; onChange: (code: string) => void; onSubmit?: () => void }) {
  return (
    <Input
      value={value.length > 4 ? formatCode(value.padEnd(8, ' ')).trim() : value}
      onChangeText={(t) => onChange(cleanCode(t))}
      placeholder="AB3D-EF7H"
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={9}
      style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center', fontWeight: '700' }}
      onSubmitEditing={onSubmit}
    />
  );
}
