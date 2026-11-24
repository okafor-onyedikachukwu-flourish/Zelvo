import { useAuth } from './auth';
import { useCurrentSchool } from './school';

/** Only an exam's creator or the head of school can change it; a head of department can only view it. */
export function useCanManageExam(createdBy: string | null | undefined): boolean {
  const { session } = useAuth();
  const { isAdmin } = useCurrentSchool();
  return isAdmin || (!!createdBy && createdBy === session?.user.id);
}
