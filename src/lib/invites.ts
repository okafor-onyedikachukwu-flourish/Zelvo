import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import { Linking, Share } from 'react-native';

/** "AB3DEF7H" → "AB3D-EF7H", easier to read out or type. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function inviteMessage(personName: string, schoolName: string, code: string, email?: string | null): string {
  return (
    `Hello ${personName}, you've been added to ${schoolName} on Zelvo.\n\n` +
    `1. Install Zelvo and create an account${email ? ` with this email (${email})` : ''}.\n` +
    `2. Tap "I'm a teacher with a code" and enter: ${formatCode(code)}\n\n` +
    `This code is only for you.`
  );
}

/** Opens the phone's email app (e.g. Gmail) with the code ready to send to the person's own email. */
export async function emailInvite(email: string, personName: string, schoolName: string, code: string) {
  const subject = `Your Zelvo join code for ${schoolName}`;
  const body = inviteMessage(personName, schoolName, code, email);
  if (await MailComposer.isAvailableAsync()) {
    await MailComposer.composeAsync({ recipients: [email], subject, body });
  } else {
    await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }
}

export function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

export async function shareInvite(personName: string, schoolName: string, code: string) {
  await Share.share({ message: inviteMessage(personName, schoolName, code) });
}

export async function copyCode(code: string) {
  await Clipboard.setStringAsync(formatCode(code));
}
