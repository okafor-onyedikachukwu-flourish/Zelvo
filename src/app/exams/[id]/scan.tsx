import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentPicker, type PickedStudent } from '../../../components/StudentPicker';
import { colors, radius, space } from '../../../components/theme';
import { Button, EmptyState, ErrorView, LoadingView } from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { FREE, UNSET } from '../../../lib/exams';
import { loadScanExam, type ScanExam } from '../../../lib/scan/examData';
import { loadPhoto, saveGrayJpeg } from '../../../lib/scan/photo';
import { addScan, syncScans } from '../../../lib/scan/queue';
import { READ_HINTS, readSheet, straighten } from '../../../lib/scan/read';
import { useLoad } from '../../../lib/useLoad';

type LastScan = {
  name: string;
  page: number;
  pages: number;
  right: number;
  counted: number;
  toCheck: number;
  blank: number;
};

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const { data, loading, error, reload } = useLoad(() => loadScanExam(id), id);

  if (loading || !permission) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="camera-outline"
          title="Allow the camera"
          text="Zelvo needs the camera to photograph answer sheets. The photos stay with your school's exam."
          action={
            <Button
              title={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            />
          }
        />
      </View>
    );
  }
  return <Scanner exam={data!} />;
}

function Scanner({ exam }: { exam: ScanExam & { offline: boolean } }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'reading' | 'saving'>('idle');
  const busy = phase !== 'idle';
  const [torch, setTorch] = useState(false);
  const [last, setLast] = useState<LastScan | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [asking, setAsking] = useState<{ subtitle: string; resolve: (p: PickedStudent) => void } | null>(null);
  const [scanned, setScanned] = useState(() => new Set(exam.scannedStudentIds));
  const names = new Map(exam.students.map((s) => [s.id, s.name]));

  function askWho(subtitle: string): Promise<PickedStudent> {
    return new Promise((resolve) => setAsking({ subtitle, resolve }));
  }

  async function handle(uri: string, width: number, height: number) {
    setNotice(null);
    setPhase('reading');
    await new Promise((r) => setTimeout(r, 30)); // let "Reading…" appear before the heavy work
    const g = await loadPhoto(uri, width, height);
    const read = readSheet(g, { id: exam.id, questionCount: exam.questionCount, optionCount: exam.optionCount });
    if (!read.ok) {
      setNotice(READ_HINTS[read.reason]);
      return;
    }
    const { code, first, answers } = read;

    let studentId = code.studentId;
    let studentName: string | null = studentId ? (names.get(studentId) ?? null) : null;
    if (studentId && !studentName) {
      studentId = null; // printed for a student who has since been removed from the class list
    }
    if (!studentId) {
      const picked = await askWho(
        code.studentId
          ? 'This sheet was printed for a student who is no longer on the class list.'
          : `Blank sheet, page ${code.page} of ${code.pages}. Choose the name written on it.`,
      );
      studentId = picked.studentId;
      studentName = picked.name;
    }

    let right = 0;
    let counted = 0;
    let toCheck = 0;
    let blank = 0;
    for (let i = 0; i < answers.length; i++) {
      const k = exam.answerKey[first - 1 + i];
      const a = answers[i];
      if (a === '#' || (a >= 'a' && a <= 'f')) toCheck++;
      if (a === '-') blank++;
      if (k === UNSET || k === undefined) continue;
      counted++;
      if (k === FREE || a.toUpperCase() === k) right++;
    }
    setLast({ name: studentName ?? 'Unnamed script', page: code.page, pages: code.pages, right, counted, toCheck, blank });
    setCount((c) => c + 1);

    // Keep a straightened copy of the page for checking later, then queue it for upload.
    setPhase('saving');
    await new Promise((r) => setTimeout(r, 30));
    const imageUri = saveGrayJpeg(straighten(g, read.toImage, 3), `${randomUUID()}.jpg`, 65);
    await addScan({
      id: randomUUID(),
      schoolId: exam.schoolId,
      examId: exam.id,
      scriptId: randomUUID(),
      studentId,
      studentName,
      page: code.page,
      first,
      answers,
      imageUri,
      createdAt: new Date().toISOString(),
    });
    syncScans().catch(() => undefined);
    if (studentId) setScanned((s) => new Set(s).add(studentId!));
  }

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setPhase('reading');
    try {
      await work();
    } catch (e) {
      setNotice(friendlyError(e));
    } finally {
      setPhase('idle');
    }
  }

  const capture = () =>
    run(async () => {
      if (!ready || !camera.current) return;
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo) await handle(photo.uri, photo.width, photo.height);
    });

  const fromGallery = () =>
    run(async () => {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 30, quality: 1 });
      if (res.canceled) return;
      for (const a of res.assets) await handle(a.uri, a.width, a.height);
    });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />

      {/* Corner guides */}
      <View pointerEvents="none" style={styles.guides}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[styles.corner, styles[c]]} />
        ))}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <RoundButton icon="close" label="Close" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>
            {exam.title}
          </Text>
          <Text style={styles.subtitle}>
            {count === 0 ? exam.className : `${count} ${count === 1 ? 'page' : 'pages'} scanned`}
            {exam.offline ? ' · offline' : ''}
          </Text>
        </View>
        <RoundButton icon={torch ? 'flash' : 'flash-off'} label="Light" onPress={() => setTorch((t) => !t)} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        {notice ? (
          <View style={[styles.card, { backgroundColor: colors.warningSoft }]}>
            <Text style={{ color: colors.warning, fontWeight: '700' }}>Try again</Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>{notice}</Text>
          </View>
        ) : last ? (
          <View style={styles.card}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }} numberOfLines={1}>
              {last.name}
              {last.pages > 1 ? `  ·  page ${last.page} of ${last.pages}` : ''}
            </Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>
              {last.counted > 0 ? `${last.right} of ${last.counted} correct on this page` : 'Saved. Enter the answer key to see the score.'}
            </Text>
            {last.toCheck > 0 || last.blank > 0 ? (
              <Text style={{ color: colors.warning, marginTop: 2 }}>
                {[last.toCheck ? `${last.toCheck} to check` : '', last.blank ? `${last.blank} left blank` : ''].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
            <Text style={{ color: colors.text }}>
              Lay the sheet flat in good light and fit the whole page in the frame, so all four black squares show.
            </Text>
          </View>
        )}

        <View style={styles.controls}>
          <RoundButton icon="images-outline" label="Choose photos" onPress={fromGallery} />
          <Pressable
            onPress={capture}
            disabled={busy || !ready}
            accessibilityLabel="Take photo"
            style={({ pressed }) => [styles.shutter, (pressed || busy) && { opacity: 0.6 }]}
          >
            {phase === 'saving' ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <RoundButton
            icon="checkmark-done"
            label="Done"
            onPress={() => router.replace({ pathname: '/exams/[id]/results', params: { id: exam.id } })}
          />
        </View>
      </View>

      {phase === 'reading' ? (
        <View style={styles.busy}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: space.sm, fontWeight: '600' }}>Reading sheet…</Text>
        </View>
      ) : null}

      <StudentPicker
        visible={asking !== null}
        title="Whose script is this?"
        subtitle={asking?.subtitle}
        students={exam.students}
        taken={scanned}
        onPick={(p) => {
          asking?.resolve(p);
          setAsking(null);
        }}
      />
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={24} color="#fff" />
    </Pressable>
  );
}

const GUIDE = 34;
const styles = StyleSheet.create({
  guides: { position: 'absolute', top: '14%', bottom: '24%', left: '8%', right: '8%' },
  corner: { position: 'absolute', width: GUIDE, height: GUIDE, borderColor: 'rgba(255,255,255,0.9)' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.md },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: space.md },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
