import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { friendlyError } from './errors';

/**
 * Loads data for a screen, and loads it again each time the screen comes back into view.
 * `key` should change whenever the loader needs to run again (e.g. a different school).
 */
export function useLoad<T>(loader: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async (pull: boolean) => {
    if (pull) setRefreshing(true);
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      run(false);
      // `key` is listed so the screen reloads when it changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, key]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    reload: useCallback(() => run(false), [run]),
    refresh: useCallback(() => run(true), [run]),
  };
}
