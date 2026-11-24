/** Turns database, network and log-in errors into a sentence a teacher can act on. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as { message?: string; code?: string };
  const msg = err.message ?? (typeof e === 'string' ? e : 'Something went wrong. Try again.');
  const code = err.code ?? '';

  if (code === '23505' && /one_hod_per_subject/.test(msg)) return 'That subject already has a head of department.';
  if (code === '23505') return 'That name is already in use.';
  if (code === '23503') return "It's used by an exam, so it can't be deleted.";
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Only a school admin can do this.';
  }
  if (/network request failed|failed to fetch|fetch failed|network error/i.test(msg)) {
    return 'No internet connection. Check your data and try again.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Wrong email or password.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return 'Confirm your email first: open the link we sent you, then log in.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(msg)) {
    return 'An account with this email already exists. Log in instead.';
  }
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a few minutes and try again.';
  return msg;
}
