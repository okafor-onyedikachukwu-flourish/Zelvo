# Zelvo

An Android app for schools, built with Expo (React Native) and Supabase. It has two parts:

- **Exams:** teachers enter the answer key, then scan students' scripts with the phone camera. Zelvo marks Zelvo-printed bubble sheets (no AI needed) and handwritten answers on any paper, such as foolscap (handwriting AI).
- **Timetable:** the admin uploads the school timetable, and each teacher's phone rings before every one of their periods, even without data.

No payments.

## Build stages

1. **Done:** accounts, schools, staff with join codes, classes, subjects and optional class lists
2. Exams and answer keys, plus the printable answer sheet (PDF)
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

## Project layout

```
src/app/                       Screens (Expo Router)
  _layout.tsx                  Start-up and which screens each person can reach
  sign-in.tsx, sign-up.tsx     Log in / create account
  welcome.tsx                  Set up a school or join one
  create-school.tsx, join-school.tsx
  (tabs)/index.tsx             Home: set-up checklist (admins) or school summary
  (tabs)/school.tsx            School: details, staff, classes, subjects
  (tabs)/account.tsx           Account: switch school, join another, log out
  staff/                       Staff list, add staff, staff member (join code, role)
  classes/                     Class list, class detail, add students (paste or CSV)
  subjects.tsx, school-details.tsx
src/components/                Shared UI
src/lib/
  supabase.ts, config.ts       Supabase connection
  auth.tsx, school.tsx         Logged-in account and current school
  names.ts                     Reads name lists from pasted text or CSV
  invites.ts                   Join code formatting and sharing
supabase/migrations/           Database schema and security rules
```

## Build an APK

The app connects to the Zelvo Supabase project out of the box (see `src/lib/config.ts`).

On expo.dev, open the **zelvo** project, connect this GitHub repository, then start an **Android** build with the **preview** profile. When it finishes, open the link on your phone and install the APK.

From a computer instead:

```bash
npm install
npx eas-cli@latest build -p android --profile preview
```

## Checks

```bash
npx tsc --noEmit
npx eslint src
```
