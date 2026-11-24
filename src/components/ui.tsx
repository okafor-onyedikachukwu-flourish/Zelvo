import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, type ComponentProps, type ComponentPropsWithRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Photo as PhotoInfo } from '../lib/photos';
import { Logo, PhotoStrip } from './Photo';
import { colors, radius, space } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Scrollable page with standard padding, pull-to-refresh and keyboard handling. */
export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.brand}>
      <Logo size={44} />
      {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A card of rows separated by thin lines. */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}>
      {content}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.muted,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.card, fg: colors.danger, border: '#F5C6C6' },
};

export function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }, disabled && { opacity: 0.45 }]}
    >
      <Text style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' }) {
  const t = {
    neutral: { bg: colors.border, fg: colors.muted },
    primary: { bg: colors.primarySoft, fg: colors.primaryDark },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Text box. Accepts a ref (React 19 passes it as a prop), e.g. to move to the next box. */
export function Input(props: ComponentPropsWithRef<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />;
}

export function Banner({
  tone,
  icon,
  title,
  text,
  action,
}: {
  tone: 'warning' | 'danger' | 'info' | 'success';
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  const t = {
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={20} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.bannerTitle, { color: t.fg }]}>{title}</Text>
        {text ? <Text style={styles.bannerText}>{text}</Text> : null}
        {action ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>{action}</View> : null}
      </View>
    </View>
  );
}

/** A friendly "nothing here yet" message, with a photo when one is given. */
export function EmptyState({
  icon,
  photo,
  title,
  text,
  action,
}: {
  icon: IconName;
  photo?: PhotoInfo;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {photo ? (
        <PhotoStrip photo={photo} height={170} style={{ alignSelf: 'stretch', marginBottom: space.sm }} />
      ) : (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={32} color={colors.primary} />
        </View>
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={[styles.center, { padding: space.xl }]}>
      <Banner tone="danger" icon="cloud-offline-outline" title="Couldn't load" text={message} />
      <Button title="Try again" icon="refresh" onPress={onRetry} />
    </View>
  );
}

/** Asks before something that can't be undone. Resolves true if confirmed. */
export function confirm(title: string, message: string, confirmText = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export const styles = StyleSheet.create({
  screen: { padding: space.lg, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  brand: { alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.xl },
  brandSubtitle: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#EEF0F5', marginLeft: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg, minHeight: 56 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.muted },
  iconButton: { padding: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  buttonSmall: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  field: { marginBottom: space.lg, gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  input: {
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  banner: { flexDirection: 'row', gap: space.md, padding: 14, borderRadius: 18, marginBottom: space.md },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 13, lineHeight: 18, color: colors.text },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.sm, gap: space.sm },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center', marginBottom: space.md },
});
