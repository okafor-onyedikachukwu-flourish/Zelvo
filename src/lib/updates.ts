import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/** New builds are published as GitHub Releases named "build-<number>" with the APK attached. */
const RELEASES = 'https://api.github.com/repos/okafor-onyedikachukwu-flourish/Zelvo/releases/latest';

export type AvailableUpdate = { build: number; url: string; sizeMb: number };

/** This app's build number (Android versionCode). */
export function currentBuild(): number {
  return Number(Application.nativeBuildVersion ?? 0) || 0;
}

let cached: { at: number; result: AvailableUpdate | null } | null = null;

/** Looks for a newer build. Checks GitHub at most every 30 minutes unless `force` is set. */
export async function checkForUpdate(force = false): Promise<AvailableUpdate | null> {
  if (Platform.OS !== 'android') return null;
  if (!force && cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.result;
  const res = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error("Couldn't check for updates. Try again later.");
  const release = (await res.json()) as {
    tag_name?: string;
    assets?: { name?: string; size?: number; browser_download_url?: string }[];
  };
  const build = Number(/^build-(\d+)$/.exec(release.tag_name ?? '')?.[1] ?? 0);
  const apk = release.assets?.find((a) => a.name?.endsWith('.apk'));
  const result =
    build > currentBuild() && apk?.browser_download_url
      ? { build, url: apk.browser_download_url, sizeMb: Math.max(1, Math.round((apk.size ?? 0) / 1048576)) }
      : null;
  cached = { at: Date.now(), result };
  return result;
}

/** Downloads the new APK and opens Android's installer. Android then asks the user to confirm. */
export async function downloadAndInstall(update: AvailableUpdate, onProgress: (fraction: number) => void) {
  const target = new File(Paths.cache, `zelvo-${update.build}.apk`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(update.url, target, {
    idempotent: true,
    onProgress: (p) => {
      if (p.totalBytes > 0) onProgress(p.bytesWritten / p.totalBytes);
    },
  });
  const contentUri = await getContentUriAsync(file.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION, so the installer can read the file
    type: 'application/vnd.android.package-archive',
  });
}
