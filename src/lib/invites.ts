import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

/** "AB3DEF7H" → "AB3D-EF7H", easier to read out or type. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function inviteMessage(personName: string, schoolName: string, code: string): string {
  return (
    `Hello ${personName}, you've been added to ${schoolName} on Zelvo.\n\n` +
    `1. Install Zelvo and create an account.\n` +
    `2. Tap "Join with a code" and enter: ${formatCode(code)}\n\n` +
    `This code is only for you.`
  );
}

export async function shareInvite(personName: string, schoolName: string, code: string) {
  await Share.share({ message: inviteMessage(personName, schoolName, code) });
}

export async function copyCode(code: string) {
  await Clipboard.setStringAsync(formatCode(code));
}
