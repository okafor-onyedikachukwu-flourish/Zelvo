import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, type ReactNode } from 'react';
import { PixelRatio, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoUri, type Photo as PhotoInfo } from '../lib/photos';
import { colors, radius, space } from './theme';

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** White status bar icons while this screen (with a dark photo at the top) is in front. */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
}

/**
 * A photo that fills its box. Until it loads (or with no internet) the box shows the photo's tint,
 * so the layout never jumps. `scrim` darkens it so white text on top stays readable.
 */
export function Photo({
  photo,
  width = 400,
  scrim,
  style,
  children,
}: {
  photo: PhotoInfo;
  /** Display width in points; the downloaded size follows the screen density. */
  width?: number;
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const px = Math.min(1600, width * Math.min(PixelRatio.get(), 2.5));
  return (
    <View style={[{ backgroundColor: photo.tint, overflow: 'hidden' }, style]}>
      <Image
        source={{ uri: photoUri(photo, px) }}
        style={fill}
        contentFit="cover"
        transition={250}
        cachePolicy="disk"
        accessibilityLabel={photo.alt}
      />
      {scrim ? <View style={[fill, { backgroundColor: 'rgba(14, 12, 44, 0.5)' }]} /> : null}
      {children}
    </View>
  );
}

/**
 * A page with a photo header and a rounded sheet sliding over it, as on Home and the student
 * dashboard. The header content sits at the bottom of the photo.
 */
export function PhotoScreen({
  photo,
  header,
  children,
  refreshing,
  onRefresh,
  height = 210,
}: {
  photo: PhotoInfo;
  header: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  height?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.primary]} progressViewOffset={insets.top} />
        ) : undefined
      }
    >
      <Photo photo={photo} width={420} scrim style={{ height: height + insets.top }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + space.md, paddingHorizontal: 20, paddingBottom: 40 }}>
          {header}
        </View>
      </Photo>
      <View style={styles.sheet}>{children}</View>
    </ScrollView>
  );
}

/** A big tappable choice with a photo on top (Who are you? and the steps after it). */
export function PhotoCard({
  photo,
  title,
  text,
  tone = 'primary',
  photoHeight = 108,
  onPress,
}: {
  photo: PhotoInfo;
  title: string;
  text: string;
  tone?: 'primary' | 'accent' | 'success';
  photoHeight?: number;
  onPress: () => void;
}) {
  const t = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    accent: { bg: colors.accentSoft, fg: colors.accentText },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      style={({ pressed }) => [styles.photoCard, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <Photo photo={photo} width={360} style={{ height: photoHeight }} />
      <View style={styles.photoCardBody}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.photoCardTitle}>{title}</Text>
          <Text style={styles.photoCardText}>{text}</Text>
        </View>
        <View style={[styles.chevron, { backgroundColor: t.bg }]}>
          <Ionicons name="chevron-forward" size={18} color={t.fg} />
        </View>
      </View>
    </Pressable>
  );
}

/** A smaller rounded photo used at the top of forms and in empty screens. */
export function PhotoStrip({ photo, height = 150, style }: { photo: PhotoInfo; height?: number; style?: StyleProp<ViewStyle> }) {
  return <Photo photo={photo} width={360} style={[{ height, borderRadius: radius.xl }, style]} />;
}

/** The orange "Z" mark beside the name. */
export function Logo({ size = 40, light }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.55 }}>Z</Text>
      </View>
      <Text style={{ fontSize: size * 0.6, fontWeight: '800', color: light ? '#FFFFFF' : colors.text, letterSpacing: -0.5 }}>Zelvo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginTop: -22,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
    padding: space.lg,
    gap: space.md,
  },
  photoCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  photoCardBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  photoCardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  photoCardText: { fontSize: 14, color: colors.muted },
  chevron: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mark: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
