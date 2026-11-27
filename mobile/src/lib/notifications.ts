import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const DRAW_WEEKDAYS = [2, 4, 7]; // Expo: 1 = Sunday, so 2 = Monday, 4 = Wednesday, 7 = Saturday.

export async function setupDrawNotifications(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("draw", {
      name: "开奖提醒",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const weekday of DRAW_WEEKDAYS) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "大乐透开奖了",
        body: "点开查看本期开奖结果",
        data: { url: "/" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: 21,
        minute: 40,
        channelId: "draw",
      },
    });
  }
  return true;
}
