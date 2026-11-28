import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { Card, Input, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getBaseUrl, saveBaseUrl } from "@/lib/config";
import { setupDrawNotifications } from "@/lib/notifications";
import { colors } from "@/lib/theme";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [baseUrl, setBaseUrl] = useState(getBaseUrl());
  const [notificationStatus, setNotificationStatus] = useState("unknown");

  useEffect(() => {
    Notifications.getPermissionsAsync().then((status) => {
      setNotificationStatus(status.granted ? "granted" : "denied");
    });
  }, []);

  const save = async () => {
    const value = await saveBaseUrl(baseUrl);
    setBaseUrl(value);
    Alert.alert("已保存", "服务器地址已更新");
  };

  const enableNotifications = async () => {
    const ok = await setupDrawNotifications();
    setNotificationStatus(ok ? "granted" : "denied");
    Alert.alert(
      ok ? "已开启" : "未开启",
      ok ? "每周一/三/六 21:40 会提醒你查看开奖结果" : "请在系统设置中允许通知",
    );
  };

  const logout = () => {
    Alert.alert("退出登录", "确定退出当前账号？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>当前账号</Text>
        <Text style={styles.value}>{user?.username ?? "未登录"}</Text>
        <Text style={styles.label}>App 版本</Text>
        <Text style={styles.value}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>服务器地址</Text>
        <Input
          value={baseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setBaseUrl}
          placeholder="https://47.108.230.103:8443"
        />
        <PrimaryButton title="保存地址" onPress={save} />
        <Text style={styles.hint}>
          手机和 NAS 需要在同一个 Wi-Fi 下。修改地址后，重新进入页面即可生效。
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>开奖提醒</Text>
        <Text style={styles.hint}>
          当前状态：
          {notificationStatus === "granted"
            ? "已允许"
            : notificationStatus === "denied"
              ? "未允许"
              : "未知"}
        </Text>
        <PrimaryButton title="开启 / 重新设置提醒" onPress={enableNotifications} />
        <Text style={styles.hint}>
          每周一、三、六 21:40 提醒“开奖了，点开看结果”。不发送中奖通知。
        </Text>
      </Card>

      <PrimaryButton title="退出登录" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
});
