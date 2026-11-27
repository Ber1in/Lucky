import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/lib/theme";

const pad = (value: number) => String(value).padStart(2, "0");

export function Balls({
  front,
  back,
  small = false,
}: {
  front: number[];
  back: number[];
  small?: boolean;
}) {
  return (
    <View style={styles.row}>
      {front.map((number) => (
        <View key={`f-${number}`} style={[styles.ball, styles.front, small && styles.small]}>
          <Text style={[styles.ballText, small && styles.smallText]}>{pad(number)}</Text>
        </View>
      ))}
      <Text style={styles.plus}>+</Text>
      {back.map((number) => (
        <View key={`b-${number}`} style={[styles.ball, styles.back, small && styles.small]}>
          <Text style={[styles.ballText, small && styles.smallText]}>{pad(number)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  ball: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  front: {
    backgroundColor: colors.primary,
  },
  back: {
    backgroundColor: colors.blue,
  },
  small: {
    width: 28,
    height: 28,
  },
  ballText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  smallText: {
    fontSize: 11,
  },
  plus: {
    color: colors.muted,
    fontSize: 14,
    marginHorizontal: 2,
  },
});
