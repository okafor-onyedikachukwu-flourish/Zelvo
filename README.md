# Zelvo

An Android app for schools, built with Expo (React Native) and Supabase. It has two parts:

- **Exams:** teachers enter the answer key, then scan students' scripts with the phone camera. Zelvo marks Zelvo-printed bubble sheets (no AI needed) and handwritten answers on any paper, such as foolscap (handwriting AI).
- **Timetable:** the admin uploads the school timetable, and each teacher's phone rings before every one of their periods, even without data.

No payments.

## Build stages

1. **Done:** accounts, schools, staff with join codes, classes, subjects and optional class lists
2. **Done:** exams and answer keys, plus the printable answer sheet (PDF)
3. **Done:** scanning on the phone (works offline), a review screen for unclear answers, and results with export
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

## How stage 3 works

- **Scan scripts** opens the camera. Each photo is read on the phone in a second or two, even without internet: Zelvo finds the four black squares, reads the QR code (exam, student, page) and checks every bubble. You can also pick photos from the gallery (e.g. sent on WhatsApp).
- Named sheets know whose script they are. For blank sheets, Zelvo asks you to pick the name from the class list (or type it). Handwritten names will be read automatically in stage 6.
- Scans are saved on the phone and uploaded as soon as there's internet. Multi-page scripts are joined automatically.
- **Results:** score, percentage and (optionally) the score converted to a "record out of" total, e.g. 40 questions recorded out of 30. Class average, highest and lowest. Export as a spreadsheet (CSV, with every answer) or PDF.
- **Checking:** answers Zelvo isn't sure of (faint, partly rubbed out) or with two bubbles shaded are marked "Check". The script screen shows a picture of that question from the sheet and lets you tap the right answer. You can also change any answer or the student.
- Only the exam's creator and the school's admins can see its scripts and page photos.

## Roles

Everyone signs up with their own email. The role comes from the school, not from the email address:

| Role | How they get it | What they can do |
| --- | --- | --- |
| **Owner of Zelvo** | Listed in `platform_admins` (flourishokafor13@gmail.com) | Dashboard of every school using Zelvo: counts only, no scores or names |
| **Head of school** | Sets up the school, or is made head of school by another head | Sets up classes, subjects, staff and class lists; sees every exam and the school's performance class by class |
| **Head of department** | Added by the head with a join code, for one subject (each subject has only one) | A teacher who also sees their subject's results in every class (view only); will enter the timetable (stage 4) |
| **Teacher** | Added by the head with a join code | Creates their own exams, prints sheets, scans and marks scripts |
| **Student** | Uses the code a teacher emailed them (joins straight away), or asks to join a school and class and a teacher or head approves | Views their released results and corrections; can't change anything |

Only an exam's creator or the head of school can change an exam or its scripts. Students see results only after the teacher switches on **Students can see results**.

### Sending join codes by email

When adding a teacher or head of department, the head of school can type the person's own email (for example their Gmail).
"Send to their email" opens the phone's email app with the code and instructions ready; the head just taps Send.
A code with an email attached only works for an account made with that email, so a forwarded code is useless to anyone else.
The email can be added or changed later on the person's page, and it is kept when a new code is made.

### Codes

- Every code is 8 letters and numbers, shown as `AB3D-EF7H`, without look-alikes (no 0/O, 1/I).
- No two codes are the same anywhere in Zelvo (staff or student, any school).
- A code doesn't contain the role. It points to the record the head of school filled in (name, role, subject, or a name on a class list), and the person's account is linked to that record when they use it. The code is then deleted.
- Each subject can have up to 2 heads of department in a school. A subject that already has 2 is greyed out when choosing a head of department.

### Student codes

On a class list, tap a student and type their email (e.g. Gmail). "Send code to their email" opens the email app with their own code and the download link.
The code only works for an account made with that email and joins the student straight away, linked to their name. Any member of staff can send student codes.
Students without a code can still ask to join and be approved under **School → Student accounts**.

## Updates inside the app

Zelvo checks GitHub Releases for a newer build when it opens. If there is one, it shows **Update available → Update now**: one tap downloads the APK and opens Android's installer (Android always asks to confirm installs from outside the Play Store, and the first time it may ask to allow installs from Zelvo). **Account → Check for updates** does the same on demand.

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
  exams/                       New exam, exam detail, edit, answer key, answer sheets,
                               scan, results, script review
src/components/                Shared UI
src/lib/
  supabase.ts, config.ts       Supabase connection
  auth.tsx, school.tsx         Logged-in account and current school
  names.ts                     Reads name lists from pasted text or CSV
  invites.ts                   Join code formatting and sharing
  exams.ts                     Answer key helpers
  sheet/layout.ts              Answer sheet measurements (shared with the scanner)
  sheet/render.ts              Draws the answer sheets as printable HTML/SVG
  scan/                        Reads photos of answer sheets on the phone; offline upload queue
  scoring.ts, results.ts       Scores, CSV and PDF export
supabase/migrations/           Database schema and security rules
docs/answer-sheet-layout.md    Answer sheet layout and how the reader works
tools/test/                    Realistic test photos for the reader
```

## Get the Android app (APK)

GitHub builds the APK automatically (`.github/workflows/build-apk.yml`), free for this public repository:

- **Every change to the app's code** starts a build. It takes about 15–20 minutes.
- To build by hand: on github.com or the GitHub app, open **Actions → Build APK → Run workflow**.
- When it's done, open the repository's **Releases**, tap the newest **Zelvo build**, then tap the `.apk` file to download and install it.

Builds are signed with a development key, so a new build installs over the previous one. (If a Zelvo built on expo.dev is installed, uninstall it once first.)

### Alternative: build on expo.dev (EAS)

The app is also linked to the **zelvo** project on expo.dev. From a GitHub Codespace (**Code → Codespaces → Create codespace on main**):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

## Checks

```bash
npx tsc --noEmit
npx eslint src
```
