import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/button/button";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, radius, shadows, spacing } from "@/theme";
import { DialogButton } from "./dialog-spec";
// .web を明示 import する(拡張子省略だと tsc が native 版 present-dialog.ts に解決して
// しまう。このファイル自体が .web なので、参照先も web 実装であることは自明)
import { dismissDialog, useDialog } from "./present-dialog.web";

// web のダイアログは「中央モーダル + オーバーレイ」の web 文法で描画する
// (409 価格改定・冪等リトライなどエラー系UXの web 側の顔)。
// ルートレイアウトの最後に置かれ、絶対配置で全画面を覆う
export function AppDialogHost() {
  const spec = useDialog((s) => s.spec);
  if (!spec) return null;

  const buttons: DialogButton[] = spec.buttons?.length ? spec.buttons : [{ text: "OK" }];
  const cancel = buttons.find((b) => b.style === "cancel");

  const run = (button?: DialogButton) => {
    // 閉じてから実行(onPress が次のダイアログを出すケースで順序が破綻しないように)
    dismissDialog();
    button?.onPress?.();
  };

  return (
    // オーバーレイのクリックは cancel 相当(Alert のタップ外離脱と同じ意味論)。
    // cancel ボタンが無い spec では「閉じるだけ」になる
    <Pressable style={styles.overlay} onPress={() => run(cancel)}>
      {/* カード内クリックがオーバーレイの onPress に伝播して閉じるのを止める */}
      <Pressable
        accessibilityViewIsModal
        style={styles.card}
        onPress={(e) => e.stopPropagation()}
      >
        <ThemedText variant="headline">{spec.title}</ThemedText>
        <ThemedText variant="subhead">{spec.message}</ThemedText>
        <View style={styles.actions}>
          {buttons.map((b) => (
            <Button
              key={b.text}
              // cancel だけ弱い見た目(secondary)。残りは primary — Alert の
              // 「太字=推奨アクション」に対応する web 側の表現
              variant={b.style === "cancel" ? "secondary" : "primary"}
              size="sm"
              title={b.text}
              onPress={() => run(b)}
            />
          ))}
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    zIndex: 1, // Stack のシーンより手前(web の同一 stacking context 内での順序付け)
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.overlay,
    cursor: "auto",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
