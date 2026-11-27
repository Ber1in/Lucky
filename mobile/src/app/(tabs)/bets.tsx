import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Balls } from "@/components/Balls";
import { Card, Input, PrimaryButton } from "@/components/ui";
import { api, type Bet, type Summary } from "@/lib/api";
import { formatMoney, pad, statusLabel } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

const PAGE_SIZE = 10;

function NumberGrid({
  max,
  selected,
  color,
  onToggle,
}: {
  max: number;
  selected: number[];
  color: "front" | "back";
  onToggle: (value: number) => void;
}) {
  const total = color === "front" ? 35 : 12;
  return (
    <View style={styles.grid}>
      {Array.from({ length: total }, (_, index) => index + 1).map((value) => {
        const isSelected = selected.includes(value);
        const disabled = !isSelected && selected.length >= max;
        return (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => onToggle(value)}
            style={[
              styles.gridButton,
              color === "front" ? styles.frontButton : styles.backButton,
              isSelected && (color === "front" ? styles.frontSelected : styles.backSelected),
              disabled && styles.gridDisabled,
            ]}
          >
            <Text
              style={[
                styles.gridText,
                isSelected && styles.gridTextSelected,
                disabled && styles.gridTextDisabled,
              ]}
            >
              {pad(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BetsScreen() {
  const [items, setItems] = useState<Bet[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawNo, setDrawNo] = useState("");
  const [front, setFront] = useState<number[]>([]);
  const [back, setBack] = useState<number[]>([]);
  const [additional, setAdditional] = useState(false);
  const [multiplier, setMultiplier] = useState("1");
  const [ticketAmount, setTicketAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        api.bets(targetPage, PAGE_SIZE),
        api.summary(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useFocusEffect(
    useCallback(() => {
      load(page);
    }, [load, page]),
  );

  const resetForm = () => {
    setEditingId(null);
    setDrawNo("");
    setFront([]);
    setBack([]);
    setAdditional(false);
    setMultiplier("1");
    setTicketAmount("");
    setFormError("");
  };

  const openCreate = async () => {
    resetForm();
    setVisible(true);
    try {
      const next = await api.nextDraw();
      setDrawNo(next.draw_no);
    } catch {
      // Leave it blank; the backend will use the next period.
    }
  };

  const openEdit = (bet: Bet) => {
    setEditingId(bet.id);
    setDrawNo(bet.draw_no);
    setFront([...bet.front_numbers]);
    setBack([...bet.back_numbers]);
    setAdditional(bet.is_additional);
    setMultiplier(String(bet.multiplier));
    setTicketAmount(bet.ticket_amount == null ? "" : String(bet.ticket_amount));
    setFormError("");
    setVisible(true);
  };

  const toggleFront = (value: number) => {
    if (front.includes(value)) {
      setFront(front.filter((item) => item !== value));
    } else if (front.length < 5) {
      setFront([...front, value].sort((a, b) => a - b));
    }
  };

  const toggleBack = (value: number) => {
    if (back.includes(value)) {
      setBack(back.filter((item) => item !== value));
    } else if (back.length < 2) {
      setBack([...back, value].sort((a, b) => a - b));
    }
  };

  const save = async () => {
    setFormError("");
    if (front.length !== 5) {
      setFormError("前区请点选 5 个号码");
      return;
    }
    if (back.length !== 2) {
      setFormError("后区请点选 2 个号码");
      return;
    }
    const multiplierValue = Number(multiplier);
    if (!Number.isInteger(multiplierValue) || multiplierValue < 1 || multiplierValue > 99) {
      setFormError("倍数必须为 1–99 的整数");
      return;
    }
    const ticketValue = ticketAmount.trim() ? Number(ticketAmount) : null;
    if (
      ticketValue !== null &&
      (!Number.isFinite(ticketValue) || ticketValue < 0 || ticketValue > 30000)
    ) {
      setFormError("整张票金额必须在 0–30000 之间");
      return;
    }

    setSaving(true);
    try {
      if (editingId !== null) {
        await api.updateBet(editingId, {
          front_numbers: front,
          back_numbers: back,
          is_additional: additional,
          multiplier: multiplierValue,
          ticket_amount: ticketValue,
        });
      } else {
        await api.createBet({
          draw_no: drawNo.trim() || null,
          front_numbers: front,
          back_numbers: back,
          is_additional: additional,
          multiplier: multiplierValue,
          ticket_amount: ticketValue,
        });
      }
      setVisible(false);
      resetForm();
      await load(editingId === null ? 1 : page);
      if (editingId === null) {
        setPage(1);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = (bet: Bet) => {
    Alert.alert("删除记录", `删除第 ${bet.draw_no} 期的这条投注？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteBet(bet.id);
            await load(1);
            setPage(1);
          } catch (err) {
            Alert.alert("删除失败", err instanceof Error ? err.message : "请稍后重试");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>我的投注</Text>
        <Pressable style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ 记录投注</Text>
        </Pressable>
      </View>

      {summary ? (
        <View style={styles.summaryGrid}>
          <SummaryCard label="已结算投入" value={formatMoney(summary.total_cost)} />
          <SummaryCard label="累计中奖" value={formatMoney(summary.total_prize)} />
          <SummaryCard
            label="净盈亏"
            value={formatMoney(summary.net)}
            color={summary.net >= 0 ? colors.success : colors.danger}
          />
          <SummaryCard label="待开奖" value={`${summary.pending_count} 注`} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((bet) => (
            <Card key={bet.id} style={styles.betCard}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.betDrawNo}>{bet.draw_no}</Text>
                  <Text style={styles.muted}>{bet.draw_date ?? "待开奖"}</Text>
                </View>
                <Text
                  style={[
                    styles.status,
                    bet.status === "won"
                      ? styles.won
                      : bet.status === "pending"
                        ? styles.pending
                        : styles.muted,
                  ]}
                >
                  {statusLabel(bet.status, bet.prize_level)}
                </Text>
              </View>
              <Balls front={bet.front_numbers} back={bet.back_numbers} small />
              <View style={styles.rowBetween}>
                <Text style={styles.muted}>
                  {bet.is_additional ? "追加" : "基本"} · {bet.multiplier} 倍 · 投入{" "}
                  {formatMoney(bet.cost)}
                </Text>
                <Text style={styles.muted}>
                  {bet.status === "won" ? formatMoney(bet.prize_amount) : "—"}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(bet)}>
                  <Text style={styles.link}>修改</Text>
                </Pressable>
                <Pressable onPress={() => remove(bet)}>
                  <Text style={styles.deleteLink}>删除</Text>
                </Pressable>
              </View>
            </Card>
          ))}
          {items.length === 0 ? <Text style={styles.muted}>还没有投注记录</Text> : null}
        </ScrollView>
      )}

      <View style={styles.pager}>
        <Pressable
          disabled={page <= 1}
          onPress={() => {
            const target = page - 1;
            setPage(target);
            load(target);
          }}
          style={[styles.pagerButton, page <= 1 && styles.disabled]}
        >
          <Text style={styles.pagerText}>上一页</Text>
        </Pressable>
        <Text style={styles.muted}>
          第 {page} / {totalPages} 页
        </Text>
        <Pressable
          disabled={page >= totalPages}
          onPress={() => {
            const target = page + 1;
            setPage(target);
            load(target);
          }}
          style={[styles.pagerButton, page >= totalPages && styles.disabled]}
        >
          <Text style={styles.pagerText}>下一页</Text>
        </Pressable>
      </View>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "修改投注" : "记录投注"}</Text>
              <Pressable onPress={() => setVisible(false)}>
                <Text style={styles.link}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Input
                label="期号（留空默认下一期）"
                value={drawNo}
                editable={editingId === null}
                keyboardType="number-pad"
                onChangeText={setDrawNo}
                placeholder="自动使用下一期"
              />
              <Input
                label="倍数（1–99）"
                value={multiplier}
                keyboardType="number-pad"
                onChangeText={setMultiplier}
              />
              <Input
                label="整张票金额（可选）"
                value={ticketAmount}
                keyboardType="decimal-pad"
                onChangeText={setTicketAmount}
                placeholder="默认本注金额"
              />

              <View style={styles.toggleRow}>
                <Text style={styles.muted}>追加（每注 +1 元）</Text>
                <Switch value={additional} onValueChange={setAdditional} />
              </View>

              <View style={styles.countRow}>
                <Text style={styles.muted}>前区（点选 5 个）</Text>
                <Text style={styles.muted}>{front.length} / 5</Text>
              </View>
              <NumberGrid max={5} selected={front} color="front" onToggle={toggleFront} />

              <View style={styles.countRow}>
                <Text style={styles.muted}>后区（点选 2 个）</Text>
                <Text style={styles.muted}>{back.length} / 2</Text>
              </View>
              <NumberGrid max={2} selected={back} color="back" onToggle={toggleBack} />

              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Text style={styles.muted}>
                本注投入：¥{(additional ? 3 : 2) * (Number(multiplier) || 0)}
              </Text>
              <PrimaryButton
                title={editingId ? "保存修改" : "记录投注"}
                onPress={save}
                loading={saving}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  summaryCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 3,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  betCard: {
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  betDrawNo: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
  },
  won: {
    color: colors.success,
  },
  pending: {
    color: colors.amber,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 16,
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
  modalScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  gridButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  frontButton: {},
  backButton: {},
  frontSelected: {
    backgroundColor: colors.primary,
  },
  backSelected: {
    backgroundColor: colors.blue,
  },
  gridDisabled: {
    opacity: 0.35,
  },
  gridText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  gridTextSelected: {
    color: colors.white,
  },
  gridTextDisabled: {
    color: colors.muted,
  },
});
