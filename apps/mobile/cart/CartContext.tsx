import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { MenuItem } from "../api/client";

interface CartLine {
  item: MenuItem;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  totalCents: number;
  totalCount: number;
  add: (item: MenuItem) => void;
  decrement: (menuItemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  function add(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function decrement(menuItemId: string) {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === menuItemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function clear() {
    setLines([]);
  }

  const totalCents = useMemo(
    () => lines.reduce((sum, l) => sum + l.item.priceCents * l.quantity, 0),
    [lines],
  );
  const totalCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, totalCents, totalCount, add, decrement, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
