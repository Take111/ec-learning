import { Pressable, StyleSheet, View } from "react-native";
import { Link, usePathname } from "expo-router";
import { ThemedText } from "@/components/themed-text/themed-text";
import { cartCount, useCart } from "@/stores/cart";
import { colors, contentWidth, interaction, spacing, radius } from "@/theme";
import { isHovered } from "@/utils/pressable-hovered";

// web の持続ヘッダーナビ。「カートは右上」という web EC の文化的規約に合わせる
// (iOS の下タブが親指到達性由来なのに対し、web のヘッダーナビはカーソルと
// ページスクロールの文脈由来 — プラットフォームごとに正解が違う)。
// 前提: (tabs) レイアウトではなくルートレイアウトに置く。商品詳細・チェックアウトは
//   ルート Stack の画面(タブ外)なので、タブ側に置くと遷移でサイトの chrome が消える
type Section = "home" | "cart" | "orders";

const NAV: { section: Section; href: "/" | "/cart" | "/orders"; label: string }[] = [
  { section: "home", href: "/", label: "商品" },
  { section: "cart", href: "/cart", label: "カート" },
  { section: "orders", href: "/orders", label: "注文履歴" },
];

function activeSection(pathname: string): Section {
  // /checkout はカート導線の続き、/products/[id] は商品導線の続きとして扱う
  if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return "cart";
  if (pathname.startsWith("/orders")) return "orders";
  return "home";
}

export function SiteHeader() {
  const pathname = usePathname();
  const active = activeSection(pathname);
  const count = useCart((s) => cartCount(s.items));

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Link href="/" asChild>
          <Pressable style={styles.brand}>
            <ThemedText variant="headline">ec-learning</ThemedText>
          </Pressable>
        </Link>
        <View style={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.section}
              href={item.href}
              label={item.label}
              active={active === item.section}
              badge={item.section === "cart" && count > 0 ? count : null}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function NavLink({
  href,
  label,
  active,
  badge,
}: {
  href: "/" | "/cart" | "/orders";
  label: string;
  active: boolean;
  badge: number | null;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={(state) => [
          styles.link,
          state.pressed
            ? { opacity: interaction.pressed }
            : isHovered(state) && { opacity: interaction.hovered },
        ]}
      >
        {/* 現在地はアクセント色で示す(ホバーは opacity — 軸を分けて両立させる) */}
        <ThemedText variant="subhead" color={active ? "accent" : "label"}>
          {label}
        </ThemedText>
        {/* バッジはラベルの右肩に絶対配置(インフロー配置だと Link(<a>)内の
            折り返しでラベルの下に落ちる) */}
        {badge !== null && (
          <View style={styles.badge}>
            <ThemedText variant="caption" color="onAccent" tabular>
              {String(badge)}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  inner: {
    width: "100%",
    maxWidth: contentWidth.wide,
    marginHorizontal: "auto",
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    cursor: "pointer",
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  link: {
    cursor: "pointer",
  },
  badge: {
    position: "absolute",
    top: -10,
    right: -14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
