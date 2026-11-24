import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { friendlyError } from '../errors';
import { must, supabase } from '../supabase';

/**
 * Scans are saved on the phone first, so scanning works without internet.
 * They're sent to Supabase as soon as there's a connection.
 */
export type PendingScan = {
  id: string;
  schoolId: string;
  examId: string;
  /** Script id made on the phone; the server may merge the page into an existing script instead. */
  scriptId: string;
  studentId: string | null;
  studentName: string | null;
  page: number;
  first: number;
  answers: string;
  imageUri: string | null;
  createdAt: string;
  /** Set once the answers are saved, so only the image is left to send. */
  savedScriptId?: string;
  /** A problem that retrying won't fix (e.g. the exam was deleted). */
  error?: string;
};

const KEY = 'zelvo.pendingScans';
const listeners = new Set<() => void>();
let running: Promise<SyncResult> | null = null;

export type SyncResult = { sent: number; offline: boolean };

export function onScansChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function read(): Promise<PendingScan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingScan[]) : [];
}

async function write(list: PendingScan[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((fn) => fn());
}

export async function pendingScans(examId?: string): Promise<PendingScan[]> {
  const list = await read();
  return examId ? list.filter((s) => s.examId === examId) : list;
}

export async function addScan(scan: PendingScan) {
  await write([...(await read()), scan]);
}

export async function discardScan(id: string) {
  const list = await read();
  const item = list.find((s) => s.id === id);
  if (item?.imageUri) deleteFile(item.imageUri);
  await write(list.filter((s) => s.id !== id));
}

/** Sends waiting scans. Safe to call often: only one send runs at a time. */
export function syncScans(): Promise<SyncResult> {
  if (!running) {
    running = sendAll().finally(() => {
      running = null;
    });
  }
  return running;
}

async function sendAll(): Promise<SyncResult> {
  let sent = 0;
  for (const item of await read()) {
    if (item.error) continue;
    try {
      let scriptId = item.savedScriptId;
      if (!scriptId) {
        scriptId = must(
          await supabase.rpc('record_scan', {
            p_script_id: item.scriptId,
            p_exam_id: item.examId,
            p_student_id: item.studentId,
            p_student_name: item.studentName,
            p_page: item.page,
            p_first: item.first,
            p_answers: item.answers,
          }),
        );
        await update(item.id, { savedScriptId: scriptId });
      }
      if (item.imageUri) {
        const file = new File(item.imageUri);
        if (file.exists) {
          const bytes = await file.bytes();
          const path = `${item.schoolId}/${item.examId}/${scriptId}/p${item.page}.jpg`;
          const { error } = await supabase.storage
            .from('scripts')
            .upload(path, bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: true });
          if (error) throw error;
          deleteFile(item.imageUri);
        }
      }
      await remove(item.id);
      sent++;
    } catch (e) {
      const message = friendlyError(e);
      if (/internet|network|fetch|timed? ?out/i.test(message)) return { sent, offline: true };
      await update(item.id, { error: message });
    }
  }
  return { sent, offline: false };
}

async function update(id: string, patch: Partial<PendingScan>) {
  await write((await read()).map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

async function remove(id: string) {
  await write((await read()).filter((s) => s.id !== id));
}

function deleteFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Removes the saved page images of a script (best effort). */
export async function deleteScriptImages(schoolId: string, examId: string, scriptId: string, pages: number[]) {
  const paths = pages.map((p) => `${schoolId}/${examId}/${scriptId}/p${p}.jpg`);
  if (paths.length) await supabase.storage.from('scripts').remove(paths);
}

/** Removes every saved page image of an exam (best effort), e.g. when the exam is deleted. */
export async function deleteExamImages(schoolId: string, examId: string) {
  const base = `${schoolId}/${examId}`;
  const { data: folders } = await supabase.storage.from('scripts').list(base, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await supabase.storage.from('scripts').list(`${base}/${folder.name}`, { limit: 100 });
    const paths = (files ?? []).map((f) => `${base}/${folder.name}/${f.name}`);
    if (paths.length) await supabase.storage.from('scripts').remove(paths);
  }
}

/** Signed link to view a page image (valid for an hour). */
export async function pageImageUrl(schoolId: string, examId: string, scriptId: string, page: number): Promise<string | null> {
  const { data } = await supabase.storage
    .from('scripts')
    .createSignedUrl(`${schoolId}/${examId}/${scriptId}/p${page}.jpg`, 3600);
  return data?.signedUrl ?? null;
}
