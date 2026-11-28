import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/lib/theme";

const pad = (value: number) => String(value).padStart(2, "0");

export function Balls({
  front,
  back,
  small = false,
  matchedFront = [],
  matchedBack = [],
}: {
  front: number[];
  back: number[];
  small?: boolean;
  matchedFront?: number[];
  matchedBack?: number[];
}) {
  const frontMatched = new Set(matchedFront);
  const backMatched = new Set(matchedBack);
  return (
    <View style={styles.row}>
      {front.map((number) => {
        const matched = frontMatched.has(number);
        return (
          <View
            key={`f-${number}`}
            style={[
              styles.ball,
              styles.front,
              small && styles.small,
              matched && styles.matched,
            ]}
          >
            <Text
              style={[styles.ballText, small && styles.smallText, matched && styles.matchedText]}
            >
              {pad(number)}
            </Text>
          </View>
        );
      })}
      <Text style={styles.plus}>+</Text>
      {back.map((number) => {
        const matched = backMatched.has(number);
        return (
          <View
            key={`b-${number}`}
            style={[
              styles.ball,
              styles.back,
              small && styles.small,
              matched && styles.matched,
            ]}
          >
            <Text
              style={[styles.ballText, small && styles.smallText, matched && styles.matchedText]}
            >
              {pad(number)}
            </Text>
          </View>
        );
      })}
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
  matched: {
    backgroundColor: "#fbbf24",
    borderWidth: 2,
    borderColor: "#f59e0b",
  },
  ballText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  smallText: {
    fontSize: 11,
  },
  matchedText: {
    color: "#78350f",
  },
  plus: {
    color: colors.muted,
    fontSize: 14,
    marginHorizontal: 2,
  },
});
