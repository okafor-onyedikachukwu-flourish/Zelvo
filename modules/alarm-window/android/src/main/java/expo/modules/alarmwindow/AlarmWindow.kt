package expo.modules.alarmwindow

import android.app.Activity
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import java.lang.ref.WeakReference

/**
 * Lets Zelvo's lesson alarm appear over the lock screen, the way a clock alarm does, without
 * letting the rest of the app show over the lock screen.
 *
 * Alarm notifications open the app with the extra "mainComponent" = MARKER. Only those launches
 * show over the lock screen; when the teacher stops or snoozes the alarm, the app goes back
 * behind the lock screen.
 */
object AlarmWindow {
  const val MARKER = "zelvo-alarm"
  private const val HANDLED = "zelvo-alarm-handled"

  @Volatile
  var activityRef: WeakReference<Activity>? = null

  /** True while the app is showing over the lock screen for an alarm. */
  @Volatile
  private var overLock = false

  /** An alarm opened the app and the alarm screen hasn't been shown for it yet. */
  @Volatile
  private var pendingLaunch = false

  fun isAlarmLaunch(intent: Intent?): Boolean {
    if (intent == null) return false
    return try {
      intent.getStringExtra("mainComponent") == MARKER
    } catch (e: Exception) {
      false
    }
  }

  /**
   * Called when the activity is created or gets a new intent. Each alarm launch is handled once:
   * the intent is marked, so a recreated activity doesn't show over the lock screen again.
   */
  fun handleLaunch(activity: Activity, intent: Intent?) {
    if (intent == null || !isAlarmLaunch(intent)) return
    if (intent.getBooleanExtra(HANDLED, false)) return
    intent.putExtra(HANDLED, true)
    pendingLaunch = true
    showOverLock(activity, true)
  }

  /** Whether an alarm opened the app since the last time this was asked. */
  fun takeLaunch(): Boolean {
    val launched = pendingLaunch
    pendingLaunch = false
    return launched
  }

  private fun showOverLock(activity: Activity, show: Boolean) {
    overLock = show
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(show)
      activity.setTurnScreenOn(show)
    } else {
      @Suppress("DEPRECATION")
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (show) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
    }
    if (show) {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    } else {
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  fun isLocked(context: Context): Boolean {
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return false
    return keyguard.isKeyguardLocked
  }

  /**
   * After an alarm shown over the lock screen: stop showing over it, and if the phone is locked,
   * return to the lock screen. Does nothing for alarms that rang while the app was open.
   */
  fun leave(activity: Activity) {
    if (!overLock) return
    val locked = isLocked(activity)
    showOverLock(activity, false)
    if (locked) activity.moveTaskToBack(true)
  }

  /**
   * Creates the alarm channel: loud like a clock alarm (alarm volume, rings in silent mode),
   * vibrates, and shows on the lock screen. Android keeps a channel's sound once created, so
   * calling this again only updates the name and description.
   */
  fun createChannel(context: Context, id: String, name: String, description: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH)
    channel.description = description
    channel.enableVibration(true)
    channel.vibrationPattern = longArrayOf(0, 700, 400, 700, 400, 700)
    channel.enableLights(true)
    channel.setBypassDnd(true)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    val sound = Uri.parse("android.resource://" + context.packageName + "/" + R.raw.zelvo_alarm)
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    channel.setSound(sound, attributes)
    manager.createNotificationChannel(channel)
  }

  /** Android 14+: the "Full screen notifications" switch for Zelvo. Older phones: notification settings. */
  fun openFullScreenSettings(activity: Activity): Boolean {
    if (Build.VERSION.SDK_INT >= 34) {
      try {
        val intent = Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT")
          .setData(Uri.parse("package:" + activity.packageName))
        activity.startActivity(intent)
        return true
      } catch (e: Exception) {
        // Some phones don't have this screen; fall through to the notification settings.
      }
    }
    return try {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
      activity.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  fun canUseFullScreen(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 34) return true
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return true
    return manager.canUseFullScreenIntent()
  }
}
