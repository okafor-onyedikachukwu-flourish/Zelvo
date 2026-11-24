import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { friendlyError } from './errors';
import { supabase } from './supabase';

/**
 * 'admin' is a head of school (the principal or the vice-principal academic);
 * 'hod' is a head of department (one subject) who also teaches.
 */
export type Role = 'admin' | 'hod' | 'teacher';
export type HeadTitle = 'principal' | 'vp_academic';

export type Membership = {
  staffId: string;
  role: Role;
  /** Which head of school: principal or vice-principal academic. */
  headTitle: HeadTitle | null;
  /** The subject a head of department is responsible for. */
  subjectId: string | null;
  fullName: string;
  school: { id: string; name: string; country: string | null; timezone: string };
};

export type StudentAccount = {
  id: string;
  schoolId: string;
  schoolName: string;
  classId: string;
  className: string;
  typedName: string;
  studentName: string | null;
  status: 'pending' | 'approved' | 'declined';
};

/** A request to join a school as staff, waiting for the principal or vice-principal. */
export type StaffRequest = {
  id: string;
  schoolId: string;
  schoolName: string;
  fullName: string;
  appliedAs: 'vp_academic' | 'hod' | 'teacher';
  subjectNames: string[];
  status: 'pending' | 'declined';
};

type Loaded = { memberships: Membership[]; studentAccounts: StudentAccount[]; staffRequests: StaffRequest[]; isOwner: boolean };

type SchoolState = {
  loading: boolean;
  /** Set when the list of schools couldn't be loaded and there's no saved copy. */
  error: string | null;
  memberships: Membership[];
  current: Membership | null;
  /** Head of school. */
  isAdmin: boolean;
  /** Head of department. */
  isHod: boolean;
  /** This account's requests to join schools as a student. */
  studentAccounts: StudentAccount[];
  /** This account's requests to join schools as staff. */
  staffRequests: StaffRequest[];
  /** The owner of Zelvo (sees the dashboard of all schools). */
  isOwner: boolean;
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
  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>([]);
  const [staffRequests, setStaffRequests] = useState<StaffRequest[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // Which account the current list belongs to; avoids showing another account's schools
  // (or the "no school yet" screen) for a moment after logging in.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(userId === null ? null : undefined);
  const [error, setError] = useState<string | null>(null);
  const loading = loadedFor !== userId;

  const apply = useCallback(async (uid: string, loaded: Loaded) => {
    const saved = await AsyncStorage.getItem(currentKey(uid));
    const list = loaded.memberships;
    setMemberships(list);
    setStudentAccounts(loaded.studentAccounts);
    setStaffRequests(loaded.staffRequests ?? []);
    setIsOwner(loaded.isOwner);
    setCurrentId((prev) => {
      const wanted = prev ?? saved;
      return list.some((m) => m.school.id === wanted) ? wanted : (list[0]?.school.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return; // signed out: nothing to load
    const [staffRes, studentRes, ownerRes, requestRes] = await Promise.all([
      supabase
        .from('staff')
        .select('id, role, head_title, full_name, subject_id, schools(id, name, country, timezone)')
        .eq('user_id', userId)
        .order('created_at'),
      supabase.rpc('my_student_accounts'),
      supabase.rpc('is_platform_admin'),
      supabase.rpc('my_staff_requests'),
    ]);
    const { data } = staffRes;
    const err = staffRes.error ?? studentRes.error ?? ownerRes.error ?? requestRes.error;

    if (err) {
      // Offline or server problem: fall back to the last saved copy so the app still opens.
      const cached = await AsyncStorage.getItem(cacheKey(userId));
      if (cached) {
        const parsed = JSON.parse(cached) as Loaded | Membership[];
        const loaded = Array.isArray(parsed) ? { memberships: parsed, studentAccounts: [], staffRequests: [], isOwner: false } : parsed;
        loaded.memberships = loaded.memberships.map((m) => ({ ...m, subjectId: m.subjectId ?? null, headTitle: m.headTitle ?? null }));
        await apply(userId, loaded);
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
        role: toRole(r.role),
        headTitle: r.head_title === 'principal' || r.head_title === 'vp_academic' ? r.head_title : null,
        subjectId: r.subject_id,
        fullName: r.full_name,
        school: r.schools,
      }));
    const loaded: Loaded = {
      memberships: list,
      studentAccounts: (studentRes.data ?? []).map((a) => ({
        id: a.id,
        schoolId: a.school_id,
        schoolName: a.school_name,
        classId: a.class_id,
        className: a.class_name,
        typedName: a.typed_name,
        studentName: a.student_name,
        status: a.status === 'approved' ? 'approved' : a.status === 'declined' ? 'declined' : 'pending',
      })),
      staffRequests: (requestRes.data ?? []).map((r) => ({
        id: r.id,
        schoolId: r.school_id,
        schoolName: r.school_name,
        fullName: r.full_name,
        appliedAs: r.applied_as === 'vp_academic' || r.applied_as === 'hod' ? r.applied_as : 'teacher',
        subjectNames: r.subject_names ?? [],
        status: r.status === 'declined' ? 'declined' : 'pending',
      })),
      isOwner: ownerRes.data === true,
    };
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(loaded));
    await apply(userId, loaded);
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
      isHod: current?.role === 'hod',
      studentAccounts,
      staffRequests,
      isOwner,
      refresh,
      switchSchool,
    };
  }, [loading, error, memberships, currentId, studentAccounts, staffRequests, isOwner, refresh, switchSchool]);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolState {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside SchoolProvider');
  return ctx;
}

/** What someone asked to join as, in words. */
export function appliedAsLabel(appliedAs: string, subjectNames: string[] = []): string {
  if (appliedAs === 'vp_academic') return 'Vice-principal academic';
  if (appliedAs === 'hod') return `Head of department${subjectNames[0] ? `, ${subjectNames[0]}` : ''}`;
  return `Teacher${subjectNames.length ? ` · ${subjectNames.join(', ')}` : ''}`;
}

/** The current school. Only use on screens that are shown once a school is chosen. */
export function useCurrentSchool() {
  const { current, isAdmin, isHod, refresh } = useSchool();
  if (!current) throw new Error('No school selected');
  return { ...current, schoolId: current.school.id, isAdmin, isHod, refresh };
}

export function toRole(role: string): Role {
  return role === 'admin' || role === 'hod' ? role : 'teacher';
}

export function roleLabel(role: string, subjectName?: string | null, headTitle?: string | null): string {
  if (role === 'admin') {
    if (headTitle === 'principal') return 'Principal';
    if (headTitle === 'vp_academic') return 'Vice-principal academic';
    return 'Head of school';
  }
  if (role === 'hod') return subjectName ? `HOD, ${subjectName}` : 'Head of department';
  return 'Teacher';
}
