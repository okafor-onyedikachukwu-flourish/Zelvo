# Zelvo

An Android app for schools, built with Expo (React Native) and Supabase. It has two parts:

- **Exams:** teachers enter the answer key, then scan students' scripts with the phone camera. Zelvo marks Zelvo-printed bubble sheets (no AI needed) and handwritten answers on any paper, such as foolscap (handwriting AI).
- **Timetable:** the admin uploads the school timetable, and each teacher's phone rings before every one of their periods, even without data.

No payments.

## Build stages

1. **Done:** accounts, schools, staff who join and are approved, classes, departments and optional class lists
2. **Done:** exams and answer keys, plus the printable answer sheet (PDF)
3. **Done:** scanning on the phone (works offline), a review screen for unclear answers, and results with export
4. **Done:** timetable: bell times, timetable upload, clash checks and the teacher screens
5. Alarms: offline scheduling, the full-screen alarm, syncing changes and exam timetable mode
6. Reading handwritten answers and names (foolscap mode)
7. Item analysis, a test in a real school, and the release build

## How stage 1 works

- Anyone can create an account, then either **set up a school** (they become its admin) or **join with a code**.
- Staff join from their own phones by choosing their school and position; the principal or vice-principal approves them.
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

## How stage 4 works (timetable)

- **Who:** the vice-principal academic and the principal set it up (School → Timetable). Everyone at the school can see it; students see their class's lessons.
- **Bell times:** one set of periods for every school day (Timetable → Bell times). Quick fill builds them from the first lesson's start, lesson length, number of lessons and up to two breaks; each period can then be renamed, retimed or turned into a break. School days (Mon–Sun) are chosen there too.
- **Tap it in:** By class → pick a class and a day → tap a period → choose the subject, the teacher (those who teach the subject first; teachers busy elsewhere at that time can't be picked) and an optional room.
- **Spreadsheet:** Timetable → Spreadsheet → get the Excel template (columns Day, Period, Class, Subject, Teacher, Room, plus a sheet of the exact names). Upload a filled .xlsx or .csv: Zelvo matches days, periods (name, number or start time), classes, subjects and teachers (any word order, Mr/Mrs ignored), lists rows it can't use, then replaces the timetable or adds the lessons that don't clash.
- **Clash checks** (also enforced by the database): a class has one lesson at a time, a teacher teaches one class at a time, no lessons in breaks or on closed days. Removing a period or closing a day removes its lessons.
- **Teachers:** Home shows the next lesson (e.g. "10:40 · Mathematics · JSS 2B, in 25 min"); Timetable → My lessons shows their week. Students see today's lessons on their dashboard and the whole week under "See the whole week".

## Roles

Everyone signs up with their own email (or Google). Right after signing up, Zelvo asks **Who are you?**

| Choice | Then | What they can do |
| --- | --- | --- |
| **Head of school → Principal** | Sets up the school (one principal per school) | Everything: classes, departments, staff approvals, every exam, performance class by class |
| **Head of school → Vice-principal academic** | Finds the school and asks to join; the principal approves (one per school) | Same as the principal; adds the departments and subjects |
| **Staff → Head of department** | Finds the school, selects their department, asks to join; the principal or vice-principal approves | A teacher who also sees their department's results in every class; will enter the timetable (stage 4) |
| **Staff → Teacher** | Finds the school, selects the subjects they teach, asks to join; approved the same way | Creates their own exams, prints sheets, scans and marks scripts |
| **Student** | Finds the school, picks their class, types their name, and goes straight to their dashboard | Sees released results once a teacher confirms them (**School → Students on Zelvo**) |
| **Owner of Zelvo** | vynkcontact01@gmail.com (made owner automatically when it signs up; see `private.owner_emails`) | Dashboard of every school: counts only, no scores or names |

- Each department is one subject. A department can have up to 2 heads.
- Staff waiting for approval see a "Waiting for approval" screen; the principal and vice-principal see requests on **Staff** and on Home.
- A student's typed name is matched to the class list (any order or capitals). If it isn't on the list, the teacher taps **Add to list & confirm**.
- Only an exam's creator or a head of school can change an exam or its scripts. Students see results only after the teacher switches on **Students can see results**.

## Signing up and logging in

- The first screen shows what Zelvo does, with **Create an account** and **Log in**.
- **Continue with Google** appears once Google sign-in is switched on in Supabase (Authentication → Providers → Google). Google sends people back to `zelvo://auth-callback`, which must be in Authentication → URL Configuration → Redirect URLs (`zelvo://**`).
- Password boxes have an eye button; common email typos (e.g. `gmial.com`) are pointed out.
- **Forgot password?** emails a code (not a link). The Supabase "Reset password" email template must include `{{ .Token }}`, and real emails need custom SMTP, because Supabase's built-in email only reaches the project's own team.
- If **Confirm email** is switched on, new accounts get a code by email to enter in the app (the "Confirm signup" template must include `{{ .Token }}`).

## Look and photos

- "Fresh & bright": white cards on a light grey background, deep indigo (`#3D35C9`) with warm orange (`#F2711C`) highlights, big rounded corners. Colours live in `src/components/theme.ts`.
- Photos are free Unsplash photos (`src/lib/photos.ts`), shown with `expo-image`: downloaded the first time, then kept on the phone. Until a photo loads (or with no internet) its space shows a matching colour. Credits are under Account → Photo credits.
- Photo screens: Start, sign-up and log-in, Who are you?, Home, the student dashboard, and the empty screens. The design preview lives in the "Zelvo app design" canvas.

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
  staff/                       Staff list with join requests, staff member (position)
  join/                        "Who are you?" steps: head of school, staff, choose school
  classes/                     Class list, class detail, add students (paste or CSV)
  subjects.tsx, school-details.tsx
  exams/                       New exam, exam detail, edit, answer key, answer sheets,
                               scan, results, script review
src/components/                Shared UI
src/lib/
  supabase.ts, config.ts       Supabase connection
  auth.tsx, school.tsx         Logged-in account and current school
  names.ts                     Reads name lists from pasted text or CSV
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
