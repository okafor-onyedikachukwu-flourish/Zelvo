// Zelvo starts here. Stop and Snooze pressed on a lesson alarm while Zelvo is closed are handled
// in the background, without opening the app.
import notifee from 'react-native-notify-kit';
import { handleAlarmAction } from './src/lib/alarms';
import 'expo-router/entry';

notifee.onBackgroundEvent(handleAlarmAction);
