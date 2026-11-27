import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { router } from "expo-router";

import { Card, Input, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Lucky</Text>
        <Text style={styles.subtitle}>大乐透数据站</Text>

        <Card style={styles.card}>
          <Input
            label="用户名"
            value={username}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
          />
          <Input
            label="密码"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title="登录" onPress={submit} loading={busy} />
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.link}>没有账号？注册</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    gap: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    textAlign: "center",
  },
});
