/** Turns database, network and log-in errors into a sentence a teacher can act on. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as { message?: string; code?: string };
  const msg = err.message ?? (typeof e === 'string' ? e : 'Something went wrong. Try again.');
  const code = err.code ?? '';

  if (code === '23505' && /lessons_class_slot/.test(msg)) return 'That class already has a lesson at that time.';
  if (code === '23505' && /lessons_teacher_slot/.test(msg)) return 'That teacher is already teaching another class at that time.';
  if (code === '23505') return 'That name is already in use.';
  if (code === '23503') return "It's used by an exam, so it can't be deleted.";
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Only the principal or vice-principal can do this.';
  }
  if (/network request failed|failed to fetch|fetch failed|network error/i.test(msg)) {
    return 'No internet connection. Check your data and try again.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Wrong email or password.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return 'Confirm your email first: enter the code we emailed you.';
  }
  if (code === 'otp_expired' || /token has expired or is invalid/i.test(msg)) {
    return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  }
  if (code === 'same_password') return 'Choose a password different from your old one.';
  if (code === 'weak_password') return 'Choose a stronger password: at least 6 characters.';
  if (code === 'email_address_invalid' || /unable to validate email address|invalid format/i.test(msg)) {
    return "That email address isn't valid. Check it and try again.";
  }
  if (code === 'provider_disabled' || /unsupported provider|provider is not enabled/i.test(msg)) {
    return "Google sign-in isn't switched on yet. Use your email and password for now.";
  }
  if (code === 'user_already_exists' || /already registered/i.test(msg)) {
    return 'An account with this email already exists. Log in instead.';
  }
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a few minutes and try again.';
  return msg;
}
