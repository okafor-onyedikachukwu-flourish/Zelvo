import { requireOptionalNativeModule } from 'expo';

/** Zelvo's own Android helper for lesson alarms (see android/…/AlarmWindow.kt). */
type AlarmWindowModule = {
  isLocked(): boolean;
  canUseFullScreen(): boolean;
  takeAlarmLaunch(): boolean;
  leave(): Promise<boolean>;
  createAlarmChannel(id: string, name: string, description: string): Promise<boolean>;
  openFullScreenSettings(): Promise<boolean>;
};

const native = requireOptionalNativeModule<AlarmWindowModule>('AlarmWindow');

/** The value the alarm notifications carry so the app knows to show over the lock screen. */
export const ALARM_MARKER = 'zelvo-alarm';

export const AlarmWindow = {
  available: !!native,
  isLocked: (): boolean => native?.isLocked() ?? false,
  canUseFullScreen: (): boolean => native?.canUseFullScreen() ?? true,
  /** True once after an alarm opened Zelvo (from the lock screen or the notification). */
  takeAlarmLaunch: (): boolean => native?.takeAlarmLaunch() ?? false,
  leave: async () => (native ? native.leave() : false),
  createAlarmChannel: async (id: string, name: string, description: string) =>
    native ? native.createAlarmChannel(id, name, description) : false,
  openFullScreenSettings: async () => (native ? native.openFullScreenSettings() : false),
};
