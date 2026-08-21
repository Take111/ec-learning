import { create } from "zustand";

// カートはローカル状態のみ(DBにカートを作らない決定 — CLAUDE.md)。
// 前提: 明細は商品ごとに1行(POST /orders が duplicate_product を拒否する契約に合わせ、
//   同一商品の追加はここでマージする)
export type CartItem = {
  productId: number;
  name: string;
  priceJpy: number;
  stock: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (item, quantity = 1) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: Math.min(i.quantity + quantity, i.stock) }
              : i,
          ),
        };
      }
      return { items: [...s.items, { ...item, quantity }] };
    }),
  // 下限は QuantityStepper が守る(1未満は来ない)。削除は remove に一本化
  setQuantity: (productId, quantity) =>
    set((s) => ({
      items: s.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    })),
  remove: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ items: [] }),
}));

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.priceJpy * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
