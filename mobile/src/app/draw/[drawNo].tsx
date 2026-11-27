import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Balls } from "@/components/Balls";
import { Card } from "@/components/ui";
import { api, type Draw } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

export default function DrawDetailScreen() {
  const { drawNo } = useLocalSearchParams<{ drawNo: string }>();
  const [draw, setDraw] = useState<Draw | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!drawNo) {
      return;
    }
    api
      .draw(drawNo)
      .then(setDraw)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [drawNo]);

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (!draw) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.baseline}>
          <Text style={styles.drawNo}>第 {draw.draw_no} 期</Text>
          <Text style={styles.muted}>{draw.draw_date}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {draw.rule_version === "seven_tier" ? "七等奖制" : "历史规则（仅展示）"}
            </Text>
          </View>
        </View>
        <Balls front={draw.front_numbers} back={draw.back_numbers} />
        <Text style={styles.muted}>奖池：{formatMoney(draw.pool_balance)}</Text>
        <Text style={styles.muted}>本期销售额：{formatMoney(draw.sales_amount)}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>奖级明细</Text>
        {draw.prizes.map((prize) => (
          <View key={prize.prize_level} style={styles.prizeRow}>
            <Text style={styles.prizeLevel}>{prize.prize_level}</Text>
            <Text style={styles.prizeAmount}>{formatMoney(prize.stake_amount)}</Text>
            <Text style={styles.muted}>{prize.stake_count ?? 0} 注</Text>
          </View>
        ))}
      </Card>
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
  baseline: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 8,
  },
  drawNo: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  prizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prizeLevel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  prizeAmount: {
    width: 120,
    textAlign: "right",
    fontSize: 14,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    padding: 16,
  },
});
