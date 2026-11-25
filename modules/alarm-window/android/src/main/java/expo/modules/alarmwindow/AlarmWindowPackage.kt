package expo.modules.alarmwindow

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

class AlarmWindowPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(AlarmWindowLifecycleListener())
  }
}

/** Shows the app over the lock screen as soon as an alarm opens it, before the first frame. */
class AlarmWindowLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    if (activity == null) return
    AlarmWindow.activityRef = WeakReference(activity)
    if (AlarmWindow.isAlarmLaunch(activity.intent)) {
      AlarmWindow.showOverLock(activity, true)
    }
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    if (!AlarmWindow.isAlarmLaunch(intent)) return false
    val activity = AlarmWindow.activityRef?.get() ?: return false
    activity.runOnUiThread { AlarmWindow.showOverLock(activity, true) }
    return false
  }

  override fun onDestroy(activity: Activity?) {
    if (AlarmWindow.activityRef?.get() === activity) {
      AlarmWindow.activityRef = null
    }
  }
}
