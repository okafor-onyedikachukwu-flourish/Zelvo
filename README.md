# Zelvo

An Android app for schools, built with Expo (React Native) and Supabase. It has two parts:

- **Exams:** teachers enter the answer key, then scan students' scripts with the phone camera. Zelvo marks Zelvo-printed bubble sheets (no AI needed) and handwritten answers on any paper, such as foolscap (handwriting AI).
- **Timetable:** the admin uploads the school timetable, and each teacher's phone rings before every one of their periods, even without data.

No payments.

## Build stages

1. **Done:** accounts, schools, staff with join codes, classes, subjects and optional class lists
2. **Done:** exams and answer keys, plus the printable answer sheet (PDF)
3. Scanning, bubble reading, a review screen for unclear answers, and results with export
4. Timetable: bell times, timetable upload, clash checks and the teacher screens
5. Alarms: offline scheduling, the full-screen alarm, syncing changes and exam timetable mode
6. Reading handwritten answers and names (foolscap mode)
7. Item analysis, a test in a real school, and the release build

## How stage 1 works

- Anyone can create an account, then either **set up a school** (they become its admin) or **join with a code**.
- The admin adds staff. Each person gets their own 8-character join code (e.g. `AB3D-EF7H`) to share on WhatsApp or SMS. A code works once and can be replaced.
- Admins manage classes, subjects and optional class lists (pasted or from a CSV file). Teachers can view them.
- Each school's data is kept separate by the database's security rules. A person can belong to more than one school and switch between them.
- A school always keeps at least one admin.

## How stage 2 works

- Any teacher can create an exam for a class and subject: title, optional date, number of objective questions (up to 1,000), options per question (A–B up to A–F) and the mark for each question.
- Only the teacher who created an exam and the school's admins can see it, its answer key and (later) its results.
- The answer key can be tapped in question by question or typed/pasted in one go ("ABDC CADB…" or "1A 2C 3B…"). It saves automatically. ✱ gives everyone the mark for a question.
- **Answer sheets** (A4 PDF, print or share): *named* sheets carry each student's name from the class list, so scanning needs no handwriting reading; *blank* sheets have boxes for the student to write their name, class and subject. Long exams continue on more pages. The layout is described in `docs/answer-sheet-layout.md`.

## Project layout

```
src/app/                       Screens (Expo Router)
  _layout.tsx                  Start-up and which screens each person can reach
  sign-in.tsx, sign-up.tsx     Log in / create account
  welcome.tsx                  Set up a school or join one
  create-school.tsx, join-school.tsx
  (tabs)/index.tsx             Home: set-up checklist (admins) or school summary
  (tabs)/exams.tsx             Exams: your exams (admins also see everyone's)
  (tabs)/school.tsx            School: details, staff, classes, subjects
  (tabs)/account.tsx           Account: switch school, join another, log out
  staff/                       Staff list, add staff, staff member (join code, role)
  classes/                     Class list, class detail, add students (paste or CSV)
  subjects.tsx, school-details.tsx
  exams/                       New exam, exam detail, edit, answer key, answer sheets
src/components/                Shared UI
src/lib/
  supabase.ts, config.ts       Supabase connection
  auth.tsx, school.tsx         Logged-in account and current school
  names.ts                     Reads name lists from pasted text or CSV
  invites.ts                   Join code formatting and sharing
  exams.ts                     Answer key helpers
  sheet/layout.ts              Answer sheet measurements (shared with the scanner)
  sheet/render.ts              Draws the answer sheets as printable HTML/SVG
supabase/migrations/           Database schema and security rules
docs/answer-sheet-layout.md    Answer sheet layout for the scanner
tools/omr_check.py             Prototype: reads a distorted photo of a filled sheet
```

## Build the Android app from your phone (GitHub Codespaces)

No computer needed. Codespaces is a free cloud computer that opens in your phone's browser. The app is already linked to the **zelvo** project on expo.dev and connects to the Zelvo Supabase project (see `src/lib/config.ts`).

1. Open the `zelvo` repository on github.com and tap **Code → Codespaces → Create codespace on main**. If the page is cramped, switch your browser to **Desktop site**. Wait until setup finishes; it installs everything automatically.
2. In the **Terminal** at the bottom, run these one at a time, answering **Y** (yes) to each question:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build --platform android --profile preview
   ```
   - `login` uses your expo.dev account.
   - The first `build` asks to create an Android signing key; say yes, and Expo stores it safely.
3. Expo builds the app on its servers (the free plan can queue for a while) and prints a link. Open it on your phone and install the APK.
4. Stop the codespace when you're done (github.com/codespaces → **⋯ → Stop**) so it doesn't use up your free hours.

After this first build, later builds can also be started from expo.dev with **Build from GitHub**.

## Checks

```bash
npx tsc --noEmit
npx eslint src
```
