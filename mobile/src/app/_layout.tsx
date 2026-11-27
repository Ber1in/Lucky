import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import { AuthProvider, useAuth } from "@/lib/auth";
import { setupDrawNotifications } from "@/lib/notifications";
import { colors } from "@/lib/theme";

function Root() {
  const { loading } = useAuth();

  useEffect(() => {
    setupDrawNotifications().catch(() => {
      // Notification permission can be granted later from Settings.
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/");
    });
    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="draw/[drawNo]"
        options={{ headerShown: true, title: "开奖详情", headerTintColor: colors.text }}
      />
    </Stack>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}
