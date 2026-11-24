import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import { Linking, Share } from 'react-native';

/** Where people download the app (latest APK on GitHub Releases). */
export const DOWNLOAD_URL = 'https://github.com/okafor-onyedikachukwu-flourish/Zelvo/releases/latest';

/** "AB3DEF7H" → "AB3D-EF7H", easier to read out or type. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

function steps(email: string | null | undefined, option: string, code: string): string {
  return (
    `1. Install Zelvo: ${DOWNLOAD_URL}\n` +
    `2. Create an account${email ? ` with this email (${email})` : ''}.\n` +
    `3. Tap "${option}" and enter: ${formatCode(code)}\n\n` +
    `This code is only for you.`
  );
}

export function inviteMessage(personName: string, schoolName: string, code: string, email?: string | null): string {
  return `Hello ${personName}, you've been added to ${schoolName} on Zelvo.\n\n` + steps(email, "I'm a teacher with a code", code);
}

export function studentInviteMessage(
  studentName: string,
  schoolName: string,
  className: string,
  code: string,
  email: string,
): string {
  return (
    `Hello ${studentName}, your teacher has added you to ${className} at ${schoolName} on Zelvo, ` +
    `where you can see your exam results.\n\n` +
    steps(email, "I'm a student", code)
  );
}

/** Opens the phone's email app (e.g. Gmail) with the message ready; the sender just taps Send. */
async function composeEmail(email: string, subject: string, body: string) {
  if (await MailComposer.isAvailableAsync()) {
    await MailComposer.composeAsync({ recipients: [email], subject, body });
  } else {
    await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }
}

export function emailInvite(email: string, personName: string, schoolName: string, code: string) {
  return composeEmail(email, `Your Zelvo join code for ${schoolName}`, inviteMessage(personName, schoolName, code, email));
}

export function emailStudentInvite(email: string, studentName: string, schoolName: string, className: string, code: string) {
  return composeEmail(
    email,
    `Your Zelvo code for ${className}, ${schoolName}`,
    studentInviteMessage(studentName, schoolName, className, code, email),
  );
}

export async function shareInvite(personName: string, schoolName: string, code: string) {
  await Share.share({ message: inviteMessage(personName, schoolName, code) });
}

export async function shareStudentInvite(studentName: string, schoolName: string, className: string, code: string, email: string) {
  await Share.share({ message: studentInviteMessage(studentName, schoolName, className, code, email) });
}

export async function copyCode(code: string) {
  await Clipboard.setStringAsync(formatCode(code));
}
