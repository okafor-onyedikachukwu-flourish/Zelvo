import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { friendlyError } from './errors';
import { supabase } from './supabase';

export type Role = 'admin' | 'teacher';

export type Membership = {
  staffId: string;
  role: Role;
  fullName: string;
  school: { id: string; name: string; country: string | null; timezone: string };
};

type SchoolState = {
  loading: boolean;
  /** Set when the list of schools couldn't be loaded and there's no saved copy. */
  error: string | null;
  memberships: Membership[];
  current: Membership | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
};

const SchoolContext = createContext<SchoolState | null>(null);

const cacheKey = (userId: string) => `zelvo.memberships.${userId}`;
const currentKey = (userId: string) => `zelvo.currentSchool.${userId}`;

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // A fresh provider for each account, so nothing carries over after logging out and in.
  return (
    <AccountSchools key={userId ?? 'signed-out'} userId={userId}>
      {children}
    </AccountSchools>
  );
}

function AccountSchools({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // Which account the current list belongs to; avoids showing another account's schools
  // (or the "no school yet" screen) for a moment after logging in.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(userId === null ? null : undefined);
  const [error, setError] = useState<string | null>(null);
  const loading = loadedFor !== userId;

  const apply = useCallback(async (uid: string, list: Membership[]) => {
    const saved = await AsyncStorage.getItem(currentKey(uid));
    setMemberships(list);
    setCurrentId((prev) => {
      const wanted = prev ?? saved;
      return list.some((m) => m.school.id === wanted) ? wanted : (list[0]?.school.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return; // signed out: nothing to load
    const { data, error: err } = await supabase
      .from('staff')
      .select('id, role, full_name, schools(id, name, country, timezone)')
      .eq('user_id', userId)
      .order('created_at');

    if (err) {
      // Offline or server problem: fall back to the last saved list so the app still opens.
      const cached = await AsyncStorage.getItem(cacheKey(userId));
      if (cached) {
        await apply(userId, JSON.parse(cached) as Membership[]);
        setError(null);
      } else {
        setError(friendlyError(err));
      }
      setLoadedFor(userId);
      return;
    }

    const list: Membership[] = (data ?? [])
      .filter((r) => r.schools)
      .map((r) => ({
        staffId: r.id,
        role: r.role === 'admin' ? 'admin' : 'teacher',
        fullName: r.full_name,
        school: r.schools,
      }));
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(list));
    await apply(userId, list);
    setError(null);
    setLoadedFor(userId);
  }, [userId, apply]);

  useEffect(() => {
    // refresh() only sets state after awaiting the network, so this doesn't cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const switchSchool = useCallback(
    async (schoolId: string) => {
      setCurrentId(schoolId);
      if (userId) await AsyncStorage.setItem(currentKey(userId), schoolId);
    },
    [userId],
  );

  const value = useMemo<SchoolState>(() => {
    const current = memberships.find((m) => m.school.id === currentId) ?? null;
    return {
      loading,
      error,
      memberships,
      current,
      isAdmin: current?.role === 'admin',
      refresh,
      switchSchool,
    };
  }, [loading, error, memberships, currentId, refresh, switchSchool]);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolState {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside SchoolProvider');
  return ctx;
}

/** The current school. Only use on screens that are shown once a school is chosen. */
export function useCurrentSchool() {
  const { current, isAdmin, refresh } = useSchool();
  if (!current) throw new Error('No school selected');
  return { ...current, schoolId: current.school.id, isAdmin, refresh };
}
