import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Balls } from "@/components/Balls";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, type Draw, type NextDraw, type Summary } from "@/lib/api";
import { formatDrawDate, formatMoney } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const [latest, setLatest] = useState<Draw | null>(null);
  const [next, setNext] = useState<NextDraw | null>(null);
  const [recent, setRecent] = useState<Draw[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [latestDraw, nextDraw, recentList] = await Promise.all([
        api.latest(),
        api.nextDraw().catch(() => null),
        api.draws(1, 5),
      ]);
      setLatest(latestDraw);
      setNext(nextDraw);
      setRecent(recentList.items);
      if (user) {
        setSummary(await api.summary());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>最新开奖</Text>
          <Pressable onPress={() => router.push("/(tabs)/history")}>
            <Text style={styles.link}>查看全部</Text>
          </Pressable>
        </View>

        {latest ? (
          <>
            <View style={styles.baseline}>
              <Text style={styles.drawNo}>第 {latest.draw_no} 期</Text>
              <Text style={styles.muted}>{latest.draw_date}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {latest.rule_version === "seven_tier" ? "七等奖制" : "历史规则"}
                </Text>
              </View>
            </View>
            <Balls front={latest.front_numbers} back={latest.back_numbers} />
            <Text style={styles.muted}>
              当前奖池（滚存至下期）：{formatMoney(latest.pool_balance)}
            </Text>
            <Text style={styles.muted}>
              上期销售额（开奖后公布）：{formatMoney(latest.sales_amount)}
            </Text>
            {next ? (
              <Text style={styles.nextText}>
                下一期：{next.draw_no} · {formatDrawDate(next.draw_date)} 21:25 开奖
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>加载中…</Text>
        )}
      </Card>

      {user && summary ? (
        <View style={styles.summaryGrid}>
          <SummaryCard label="已结算投入" value={formatMoney(summary.total_cost)} />
          <SummaryCard label="累计中奖" value={formatMoney(summary.total_prize)} />
          <SummaryCard
            label="净盈亏"
            value={formatMoney(summary.net)}
            color={summary.net >= 0 ? colors.success : colors.danger}
          />
          <SummaryCard
            label="待开奖"
            value={`${summary.pending_count} 注`}
          />
        </View>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>最近 5 期</Text>
        {recent.map((draw) => (
          <Pressable
            key={draw.draw_no}
            style={styles.recentRow}
            onPress={() => router.push(`/draw/${draw.draw_no}`)}
          >
            <Text style={styles.recentDrawNo}>{draw.draw_no}</Text>
            <Balls front={draw.front_numbers} back={draw.back_numbers} small />
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ))}
        {recent.length === 0 ? <Text style={styles.muted}>暂无数据</Text> : null}
      </Card>
    </ScrollView>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  nextText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  link: {
    fontSize: 13,
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentDrawNo: {
    width: 48,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
});
