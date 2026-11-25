package expo.modules.alarmwindow

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlarmWindowModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlarmWindow")

    Function("isLocked") {
      val context = appContext.reactContext ?: return@Function false
      AlarmWindow.isLocked(context)
    }

    Function("canUseFullScreen") {
      val context = appContext.reactContext ?: return@Function true
      AlarmWindow.canUseFullScreen(context)
    }

    Function("takeAlarmLaunch") {
      AlarmWindow.takeLaunch()
    }

    AsyncFunction("leave") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.runOnUiThread { AlarmWindow.leave(activity) }
      true
    }

    AsyncFunction("createAlarmChannel") { id: String, name: String, description: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      AlarmWindow.createChannel(context, id, name, description)
      true
    }

    AsyncFunction("openFullScreenSettings") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      AlarmWindow.openFullScreenSettings(activity)
    }
  }
}
