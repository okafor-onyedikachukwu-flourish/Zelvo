import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatDate } from './sheet/render';
import { scoreScript, type ScriptScore } from './scoring';

export type ResultExam = {
  title: string;
  exam_date: string | null;
  question_count: number;
  answer_key: string;
  mark_per_question: number;
  record_out_of: number | null;
  className: string;
  subjectName: string;
};

export type ResultRow = { name: string; answers: string; score: ScriptScore };

export function buildRows(
  exam: ResultExam,
  scripts: { student_id: string | null; student_name: string | null; answers: string }[],
  names: Map<string, string>,
): ResultRow[] {
  const mark = Number(exam.mark_per_question);
  const outOf = exam.record_out_of === null ? null : Number(exam.record_out_of);
  return scripts
    .map((s) => ({
      name: (s.student_id ? names.get(s.student_id) : null) ?? s.student_name ?? 'Unnamed script',
      answers: s.answers,
      score: scoreScript(s.answers, exam.answer_key, mark, outOf),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Spreadsheet of results, one row per script, with each question's answer (opens in Excel or Google Sheets). */
export async function shareResultsCsv(exam: ResultExam, rows: ResultRow[]) {
  const outOf = exam.record_out_of === null ? null : Number(exam.record_out_of);
  const header = ['Name', 'Score', 'Out of', 'Percent'];
  if (outOf) header.push(`Recorded (out of ${outOf})`);
  header.push('To check');
  for (let i = 1; i <= exam.question_count; i++) header.push(`Q${i}`);
  const lines = [header];
  for (const r of rows) {
    const line = [r.name, String(r.score.score), String(r.score.outOf), String(r.score.percent)];
    if (outOf) line.push(String(r.score.recorded ?? ''));
    line.push(String(r.score.toCheck));
    for (let i = 0; i < exam.question_count; i++) {
      const a = r.answers[i] ?? '?';
      line.push(a === '?' ? '' : a === '#' ? 'multiple' : a === '-' ? 'blank' : a.toUpperCase());
    }
    lines.push(line);
  }
  lines.push([]);
  lines.push(['Answer key', '', '', '', ...(outOf ? [''] : []), '', ...exam.answer_key.split('').map((k) => (k === '*' ? 'any' : k === '?' ? '' : k))]);
  const csv = lines.map((l) => l.map(csvField).join(',')).join('\r\n');
  const file = new File(Paths.cache, `${safeName(`${exam.subjectName} ${exam.className} - ${exam.title} - results`)}.csv`);
  if (file.exists) file.delete();
  file.write('﻿' + csv); // BOM so Excel reads names with accents correctly
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share results', UTI: 'public.comma-separated-values-text' });
}

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** One-page (or longer) printable list of results. */
export async function shareResultsPdf(exam: ResultExam, rows: ResultRow[], schoolName: string) {
  const outOf = exam.record_out_of === null ? null : Number(exam.record_out_of);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const scored = rows.filter((r) => r.score.outOf > 0);
  const avg = scored.length ? scored.reduce((s, r) => s + r.score.percent, 0) / scored.length : 0;
  const body = rows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="n">${r.score.score} / ${r.score.outOf}</td><td class="n">${r.score.percent}%</td>${
        outOf ? `<td class="n">${r.score.recorded ?? ''}</td>` : ''
      }</tr>`,
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Roboto, Arial, sans-serif; color: #111827; font-size: 11pt; }
    h1 { font-size: 16pt; margin: 0 0 2mm; } p { margin: 0 0 1mm; color: #4B5563; }
    table { width: 100%; border-collapse: collapse; margin-top: 6mm; }
    th, td { border-bottom: 0.3mm solid #E5E7EB; padding: 2mm 1.5mm; text-align: left; }
    th { font-size: 9pt; text-transform: uppercase; color: #4B5563; } .n { text-align: right; }
  </style></head><body>
    <h1>${esc(exam.title)}</h1>
    <p>${esc([schoolName, exam.subjectName, exam.className, formatDate(exam.exam_date)].filter(Boolean).join(' · '))}</p>
    <p>${rows.length} scripts · average ${Math.round(avg * 10) / 10}%</p>
    <table><thead><tr><th>#</th><th>Name</th><th class="n">Score</th><th class="n">%</th>${outOf ? `<th class="n">Out of ${outOf}</th>` : ''}</tr></thead>
    <tbody>${body}</tbody></table></body></html>`;
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const target = new File(Paths.cache, `${safeName(`${exam.subjectName} ${exam.className} - ${exam.title} - results`)}.pdf`);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Share results', UTI: 'com.adobe.pdf' });
}
