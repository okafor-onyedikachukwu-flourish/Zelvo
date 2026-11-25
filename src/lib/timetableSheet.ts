// Timetable spreadsheets: a ready-made Excel template, and reading a filled-in Excel or CSV file.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { DAYS, formatTime, minutes, nameKey, personKey, type Lesson, type TimetableData } from './timetable';

const HEADERS = ['Day', 'Period', 'Class', 'Subject', 'Teacher', 'Room'];

/** Builds the template (with this school's real names) and opens the share sheet. */
export async function shareTemplate(data: TimetableData, schoolName: string) {
  const lessonPeriods = data.periods.filter((p) => !p.is_break);
  const example: string[][] = [];
  const c = data.classes[0]?.name ?? 'JSS 1A';
  data.subjects.slice(0, 2).forEach((s, i) => {
    const p = lessonPeriods[i];
    const t = data.teachers.find((x) => x.subjectIds.includes(s.id));
    if (p) example.push([DAYS[0].long, p.label, c, s.name, t?.name ?? '', '']);
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...example]);
  sheet['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'Timetable');

  // A second sheet listing the exact names Zelvo knows, to copy from.
  const columns: string[][] = [
    ['Days', ...data.days.map((d) => DAYS.find((x) => x.n === d)!.long)],
    ['Periods', ...lessonPeriods.map((p) => `${p.label} (${formatTime(p.starts_at)})`)],
    ['Classes', ...data.classes.map((x) => x.name)],
    ['Subjects', ...data.subjects.map((x) => x.name)],
    ['Teachers', ...data.teachers.map((x) => x.name)],
  ];
  const height = Math.max(...columns.map((col) => col.length));
  const lists = Array.from({ length: height }, (_, r) => columns.map((col) => col[r] ?? ''));
  const listSheet = XLSX.utils.aoa_to_sheet(lists);
  listSheet['!cols'] = columns.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, listSheet, 'Names to use');

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  const file = new File(Paths.cache, `${schoolName.replace(/[\\/:*?"<>|]+/g, ' ').trim()} - timetable template.xlsx`);
  if (file.exists) file.delete();
  await file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Timetable template',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

/** The first sheet of an Excel (.xlsx/.xls/.ods) or CSV file, as rows of text. */
export async function readSheetRows(uri: string, name: string): Promise<string[][]> {
  const file = new File(uri);
  const wb = /\.(csv|txt)$/i.test(name)
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.base64(), { type: 'base64' });
  const first = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(first, { header: 1, raw: false, defval: '', blankrows: false });
  return rows.map((r) => r.map((v) => String(v ?? '').trim()));
}

export type Draft = Omit<Lesson, 'id'> & { row: number };
export type SheetCheck = {
  lessons: Draft[];
  /** Rows that can't be used. */
  problems: { row: number; text: string }[];
  /** Rows used with a note (e.g. teacher not found). */
  notes: { row: number; text: string }[];
};

function parseDay(s: string): number | null {
  const k = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^[1-7]$/.test(k)) return Number(k);
  const d = DAYS.find((x) => k.startsWith(x.short.toLowerCase()));
  return d ? d.n : null;
}

/** "8:00", "08:00", "8:00 AM", "1:30pm" → minutes after midnight. */
function parseClock(s: string): number | null {
  const m = s.trim().toLowerCase().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

/** Matches each row to this school's days, periods, classes, subjects and teachers. */
export function checkRows(rows: string[][], data: TimetableData): SheetCheck {
  const out: SheetCheck = { lessons: [], problems: [], notes: [] };
  if (rows.length === 0) return out;

  // Find the header row (it names Day and Class); without one, use the template's column order.
  let col = { day: 0, period: 1, class: 2, subject: 3, teacher: 4, room: 5 };
  let start = 0;
  const headerAt = rows.findIndex((r) => r.some((c) => /^day$/i.test(c)) && r.some((c) => /^class$/i.test(c)));
  if (headerAt >= 0) {
    const h = rows[headerAt].map((c) => c.toLowerCase());
    const find = (re: RegExp) => h.findIndex((c) => re.test(c));
    col = {
      day: find(/^day/),
      period: find(/^(period|time|lesson)/),
      class: find(/^(class|arm|form)/),
      subject: find(/^(subject|department)/),
      teacher: find(/^(teacher|staff)/),
      room: find(/^(room|venue|place)/),
    };
    start = headerAt + 1;
  }

  const lessonPeriods = data.periods.filter((p) => !p.is_break);
  const byLabel = new Map(data.periods.map((p) => [nameKey(p.label), p]));
  const classes = new Map(data.classes.map((c) => [nameKey(c.name), c]));
  const subjects = new Map(data.subjects.map((s) => [nameKey(s.name), s]));
  const teachers = new Map(data.teachers.map((t) => [personKey(t.name), t]));
  const seenClass = new Map<string, number>();
  const seenTeacher = new Map<string, number>();

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const row = i + 1;
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    if ([col.day, col.period, col.class, col.subject].every((c) => !get(c))) continue; // empty row

    const day = parseDay(get(col.day));
    if (!day) {
      out.problems.push({ row, text: `"${get(col.day) || 'blank'}" isn't a day.` });
      continue;
    }
    if (!data.days.includes(day)) {
      out.problems.push({ row, text: `The school is closed on ${DAYS[day - 1].long}.` });
      continue;
    }

    const pText = get(col.period);
    const label = byLabel.get(nameKey(pText));
    const clock = parseClock(pText);
    const period =
      (label && !label.is_break ? label : undefined) ??
      (/^\d{1,2}$/.test(pText) ? lessonPeriods[Number(pText) - 1] : undefined) ??
      (clock !== null ? lessonPeriods.find((p) => minutes(p.starts_at) === clock) : undefined);
    if (!period) {
      out.problems.push({ row, text: label?.is_break ? `"${pText}" is a break.` : `No period called "${pText || 'blank'}".` });
      continue;
    }

    const cls = classes.get(nameKey(get(col.class)));
    if (!cls) {
      out.problems.push({ row, text: `No class called "${get(col.class) || 'blank'}".` });
      continue;
    }
    const subject = subjects.get(nameKey(get(col.subject)));
    if (!subject) {
      out.problems.push({ row, text: `No department or subject called "${get(col.subject) || 'blank'}".` });
      continue;
    }

    const tName = get(col.teacher);
    let teacherId: string | null = null;
    if (tName) {
      const t = teachers.get(personKey(tName));
      if (t) teacherId = t.id;
      else out.notes.push({ row, text: `No staff member called "${tName}", so this lesson has no teacher yet.` });
    }

    const classSlot = `${cls.id}|${day}|${period.id}`;
    if (seenClass.has(classSlot)) {
      out.problems.push({ row, text: `${cls.name} already has a lesson then (row ${seenClass.get(classSlot)}).` });
      continue;
    }
    if (teacherId) {
      const teacherSlot = `${teacherId}|${day}|${period.id}`;
      if (seenTeacher.has(teacherSlot)) {
        out.problems.push({ row, text: `${tName} is already teaching then (row ${seenTeacher.get(teacherSlot)}).` });
        continue;
      }
      seenTeacher.set(teacherSlot, row);
    }
    seenClass.set(classSlot, row);
    out.lessons.push({
      row,
      day,
      period_id: period.id,
      class_id: cls.id,
      subject_id: subject.id,
      teacher_id: teacherId,
      room: get(col.room) || null,
    });
  }
  return out;
}

/** Lessons from the file that clash with lessons already in the timetable. */
export function clashesWithExisting(drafts: Draft[], existing: Lesson[]): Set<number> {
  const classSlots = new Set(existing.map((l) => `${l.class_id}|${l.day}|${l.period_id}`));
  const teacherSlots = new Set(existing.filter((l) => l.teacher_id).map((l) => `${l.teacher_id}|${l.day}|${l.period_id}`));
  const rows = new Set<number>();
  for (const d of drafts) {
    if (classSlots.has(`${d.class_id}|${d.day}|${d.period_id}`)) rows.add(d.row);
    if (d.teacher_id && teacherSlots.has(`${d.teacher_id}|${d.day}|${d.period_id}`)) rows.add(d.row);
  }
  return rows;
}
