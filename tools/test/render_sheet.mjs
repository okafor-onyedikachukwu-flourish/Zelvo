// Transpile the sheet code, render sample sheets to HTML for checking.
const ROOT = new URL('../../', import.meta.url).pathname;
import fs from 'fs';
const ts = (await import(ROOT + 'node_modules/typescript/lib/typescript.js')).default;
const root = ROOT + 'src/lib/sheet';
for (const f of ['layout', 'render']) {
  let js = ts.transpileModule(fs.readFileSync(`${root}/${f}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  js = js.replace("from './layout'", "from './layout.mjs'").replace(
    "from 'qrcode-generator'",
    `from '${ROOT}node_modules/qrcode-generator/dist/qrcode.mjs'`,
  );
  fs.writeFileSync(`/tmp/zelvo-sheet/${f}.mjs`, js);
}
const { sheetsHtml, pageSvg } = await import('/tmp/zelvo-sheet/render.mjs');
const exam = {
  id: '3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b',
  title: 'First Term Examination',
  examDate: '2026-12-08',
  questionCount: Number(process.argv[2] ?? 60),
  optionCount: Number(process.argv[3] ?? 4),
  markPerQuestion: 1,
  className: 'SS1A',
  subjectName: 'Physics',
  schoolName: 'Unity Secondary School, Nnewi',
};
const students = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Okeke Chidinma Adaeze' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', name: "O'Brien & Sons <Test>" },
];
fs.writeFileSync('/tmp/zelvo-sheet/named.html', sheetsHtml(exam, students));
fs.writeFileSync('/tmp/zelvo-sheet/blank.html', sheetsHtml(exam, null, 1));
fs.writeFileSync('/tmp/zelvo-sheet/named-p1.svg', pageSvg(exam, students[0], 1, 1));
fs.writeFileSync('/tmp/zelvo-sheet/blank-p1.svg', pageSvg(exam, null, 1, 1));
console.log('ok');
