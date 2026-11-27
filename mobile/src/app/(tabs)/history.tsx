import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Balls } from "@/components/Balls";
import { api, type Draw } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Draw[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.draws(targetPage, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(page);
    }, [load, page]),
  );

  const go = (next: number) => {
    const target = Math.min(Math.max(1, next), totalPages);
    setPage(target);
    load(target);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>历史开奖</Text>
        <Text style={styles.muted}>共 {total} 期</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.draw_no}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/draw/${item.draw_no}`)}
            >
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.drawNo}>{item.draw_no}</Text>
                  <Text style={styles.muted}>{item.draw_date}</Text>
                </View>
                <Balls front={item.front_numbers} back={item.back_numbers} small />
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>暂无数据</Text>}
        />
      )}

      <View style={styles.pager}>
        <Pressable
          disabled={page <= 1}
          onPress={() => go(page - 1)}
          style={[styles.pagerButton, page <= 1 && styles.disabled]}
        >
          <Text style={styles.pagerText}>上一页</Text>
        </Pressable>
        <Text style={styles.muted}>
          第 {page} / {totalPages} 页
        </Text>
        <Pressable
          disabled={page >= totalPages}
          onPress={() => go(page + 1)}
          style={[styles.pagerButton, page >= totalPages && styles.disabled]}
        >
          <Text style={styles.pagerText}>下一页</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  drawNo: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  pagerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pagerText: {
    fontSize: 14,
    color: colors.text,
  },
  disabled: {
    opacity: 0.35,
  },
});
