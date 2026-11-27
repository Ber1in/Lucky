import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { api, type Insights, type NumberStat } from "@/lib/api";
import { pad } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

const WINDOWS = [
  { value: "1m", label: "近 1 个月" },
  { value: "3m", label: "近 3 个月" },
  { value: "1y", label: "近 1 年" },
  { value: "3y", label: "近 3 年" },
];

export default function StatsScreen() {
  const [window, setWindow] = useState("1y");
  const [includeNine, setIncludeNine] = useState(false);
  const [includeSix, setIncludeSix] = useState(false);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.insights(window, includeNine, includeSix));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [window, includeNine, includeSix]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.windowRow}>
        {WINDOWS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setWindow(item.value)}
            style={[styles.windowButton, window === item.value && styles.windowActive]}
          >
            <Text
              style={[
                styles.windowText,
                window === item.value && styles.windowTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleItem}>
          <Text style={styles.muted}>包含九等奖制</Text>
          <Switch value={includeNine} onValueChange={setIncludeNine} />
        </View>
        <View style={styles.toggleItem}>
          <Text style={styles.muted}>包含六等奖制</Text>
          <Switch value={includeSix} onValueChange={setIncludeSix} />
        </View>
      </View>

      <Text style={styles.notice}>
        统计仅供记录与观察，不构成预测依据。当前样本：{data?.sample_size ?? 0} 期。
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {data ? (
        <>
          <StatCard title="前区 01–35" rows={data.front} color={colors.primary} />
          <StatCard title="后区 01–12" rows={data.back} color={colors.blue} />
        </>
      ) : null}
    </ScrollView>
  );
}

function StatCard({
  title,
  rows,
  color,
}: {
  title: string;
  rows: NumberStat[];
  color: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.number} style={styles.statRow}>
          <Text style={styles.statNumber}>{pad(row.number)}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: color, width: `${(row.count / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.statCount}>{row.count}</Text>
          <Text style={styles.statPct}>{row.pct}%</Text>
          <Text style={styles.statOmission}>
            {row.omission === null ? "从未" : `遗漏 ${row.omission}`}
          </Text>
        </View>
      ))}
    </View>
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
  windowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  windowButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  windowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  windowText: {
    fontSize: 13,
    color: colors.muted,
  },
  windowTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  notice: {
    fontSize: 12,
    color: colors.amber,
    backgroundColor: "#fffbeb",
    borderRadius: radius.md,
    padding: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statNumber: {
    width: 26,
    fontSize: 12,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: radius.pill,
  },
  statCount: {
    width: 28,
    textAlign: "right",
    fontSize: 12,
    color: colors.text,
  },
  statPct: {
    width: 44,
    textAlign: "right",
    fontSize: 11,
    color: colors.muted,
  },
  statOmission: {
    width: 58,
    textAlign: "right",
    fontSize: 11,
    color: colors.muted,
  },
});
