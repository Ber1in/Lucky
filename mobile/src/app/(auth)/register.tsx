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

export default function Register() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await signUp(username.trim(), password, inviteCode.trim());
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
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
        <Text style={styles.title}>注册</Text>
        <Text style={styles.subtitle}>用户名 3–32 位（不区分大小写），密码至少 8 位</Text>

        <Card style={styles.card}>
          <Input
            label="用户名"
            value={username}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
          />
          <Input
            label="邀请码"
            value={inviteCode}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setInviteCode}
          />
          <Input label="密码" value={password} secureTextEntry onChangeText={setPassword} />
          <Input label="确认密码" value={confirm} secureTextEntry onChangeText={setConfirm} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title="注册" onPress={submit} loading={busy} />
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>已有账号？返回登录</Text>
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
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
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
