import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { friendlyError } from '../lib/errors';
import { checkForUpdate, downloadAndInstall, type AvailableUpdate } from '../lib/updates';
import { space } from './theme';
import { Banner, Button } from './ui';

/** Shows "Update available" with a one-tap update when a newer build has been published. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkForUpdate()
      .then((u) => active && setUpdate(u))
      .catch(() => undefined); // no internet: just don't show anything
    return () => {
      active = false;
    };
  }, []);

  if (!update) return null;

  async function install() {
    if (!update) return;
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(update, setProgress);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <View style={{ marginBottom: space.md }}>
      <Banner
        tone="success"
        icon="arrow-up-circle-outline"
        title="Update available"
        text={
          error ??
          (progress !== null
            ? `Downloading… ${Math.round(progress * 100)}%`
            : `A new version of Zelvo (build ${update.build}, ${update.sizeMb} MB) is ready.`)
        }
        action={<Button small icon="download-outline" title="Update now" onPress={install} loading={progress !== null} />}
      />
    </View>
  );
}
