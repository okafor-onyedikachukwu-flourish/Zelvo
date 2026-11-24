// Helpers for signing up and logging in: Google sign-in and spotting typos in email addresses.
import * as WebBrowser from 'expo-web-browser';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { supabase } from './supabase';

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

export function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}
