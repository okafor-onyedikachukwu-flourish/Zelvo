// Helpers for signing up and logging in: join codes used before an account exists,
// Google sign-in, and spotting typos in email addresses.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { friendlyError } from './errors';
import { supabase } from './supabase';

// ---------- Codes typed before signing up ----------

export type CodeInfo = {
  code: string;
  kind: 'staff' | 'student';
  schoolName: string;
  personName: string;
  role: string;
  subjectName: string | null;
  className: string | null;
  email: string | null;
};

/** Who a code is for, or null if no such code. Works before signing in. */
export async function lookUpCode(code: string): Promise<CodeInfo | null> {
  const { data, error } = await supabase.rpc('peek_code', { p_code: code });
  if (error) throw error;
  const r = data?.[0];
  if (!r) return null;
  const info: CodeInfo = {
    code,
    kind: r.kind === 'student' ? 'student' : 'staff',
    schoolName: r.school_name,
    personName: r.person_name,
    role: r.role,
    subjectName: r.subject_name,
    className: r.class_name,
    email: r.email,
  };
  codeCache.set(code, info);
  return info;
}

/** The last looked-up details of a code, if this screen session has them. */
export function cachedCode(code: string): CodeInfo | null {
  return codeCache.get(code) ?? null;
}

/** "Head of department · Maths", "Teacher", "Student · JSS1A". */
export function describeCode(c: CodeInfo): string {
  if (c.kind === 'student') return `Student${c.className ? ` · ${c.className}` : ''}`;
  if (c.role === 'admin') return 'Head of school';
  if (c.role === 'hod') return `Head of department${c.subjectName ? ` · ${c.subjectName}` : ''}`;
  return 'Teacher';
}

const PENDING_KEY = 'zelvo.pendingCode';
const codeCache = new Map<string, CodeInfo>();

/** Remember a code to use as soon as the new account is signed in (it survives the app closing). */
export async function rememberCode(code: string, kind: CodeInfo['kind']) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ code, kind }));
}

export async function forgetCode() {
  await AsyncStorage.removeItem(PENDING_KEY);
}

/** Uses a remembered code, if any. Called once the account is signed in, before the app decides where to go. */
export async function redeemPendingCode() {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return;
  await forgetCode();
  try {
    const { code, kind } = JSON.parse(raw) as { code: string; kind: CodeInfo['kind'] };
    const res =
      kind === 'student'
        ? await supabase.rpc('join_as_student', { p_code: code })
        : await supabase.rpc('join_school', { p_code: code });
    if (res.error) throw res.error;
  } catch (e) {
    Alert.alert("Your join code couldn't be used", friendlyError(e));
  }
}

// ---------- What the person said they're here to do ----------

export type Intent = 'school' | 'student';
let intent: Intent | null = null;

export function setIntent(i: Intent | null) {
  intent = i;
}

export function takeIntent(): Intent | null {
  const i = intent;
  intent = null;
  return i;
}

// ---------- Google ----------

const REDIRECT = 'zelvo://auth-callback';
let googleOn: boolean | null = null;

/** Whether "Continue with Google" has been switched on in Supabase. */
export async function googleEnabled(): Promise<boolean> {
  if (googleOn !== null) return googleOn;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    const json = (await res.json()) as { external?: { google?: boolean } };
    googleOn = !!json.external?.google;
  } catch {
    return false; // offline: try again next time
  }
  return googleOn;
}

function urlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = [url.split('#')[1] ?? '', (url.split('#')[0].split('?')[1] ?? '')];
  for (const part of parts) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return out;
}

/** Opens Google's account picker. Returns false if the person closed it. */
export async function signInWithGoogle(): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
  if (res.type !== 'success') return false;
  const p = urlParams(res.url);
  if (p.error || p.error_description) throw new Error(p.error_description || 'Google sign-in did not finish. Try again.');
  if (!p.access_token || !p.refresh_token) throw new Error('Google sign-in did not finish. Try again.');
  const { error: sessionError } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
  if (sessionError) throw sessionError;
  return true;
}

// ---------- Email typos ----------

const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

/** "ada@gmial.com" → "ada@gmail.com"; null when nothing looks wrong. */
export function suggestEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const domain = e.slice(at + 1);
  let fixed = DOMAIN_FIXES[domain];
  if (!fixed && domain.endsWith('.con')) fixed = domain.slice(0, -4) + '.com';
  return fixed ? `${e.slice(0, at)}@${fixed}` : null;
}

export function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}
