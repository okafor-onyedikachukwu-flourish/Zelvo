import { Redirect } from 'expo-router';

/**
 * Google sends people back to zelvo://auth-callback. The sign-in itself is finished by the
 * screen that opened Google; this route only stops the link from showing "page not found".
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
