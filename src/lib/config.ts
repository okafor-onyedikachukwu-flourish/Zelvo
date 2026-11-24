// Supabase project for Zelvo. The publishable key is meant to ship inside the app:
// what each person can read or change is enforced by the database's security rules.
// To point a build at another project, set these as environment variables on expo.dev.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yuolzyndkhuwmkulswdd.supabase.co';

export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_7pBz0kFATiwLbr5GdRusog_cflE8bnJ';
