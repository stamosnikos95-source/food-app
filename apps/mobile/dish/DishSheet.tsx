import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { allergenLabel } from "@food-app/shared-types";
import { MenuItem } from "../api/client";
import { useCart } from "../cart/CartContext";
import { DishImage } from "../components/DishImage";
import { PrimaryButton } from "../components/PrimaryButton";
import { QuantityControl } from "../components/QuantityControl";
import { formatGrams, formatPrice } from "../lib/format";
import { theme } from "../theme";

const Ctx = createContext<(item: MenuItem) => void>(() => undefined);
/** Open a dish's detail sheet from anywhere. */
export const useOpenDish = () => useContext(Ctx);

export function DishSheetProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<MenuItem | null>(null);
  const open = useCallback((dish: MenuItem) => setItem(dish), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      <DishSheet item={item} onClose={() => setItem(null)} />
    </Ctx.Provider>
  );
}

function DishSheet({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  if (!item) return null;
  const diet = item.dietTags?.includes("vegan") ? "Vegan" : item.dietTags?.includes("vegetarian") ? "Χορτοφαγικό" : null;

  function add() {
    for (let i = 0; i < quantity; i++) cart.add(item as MenuItem);
    setQuantity(1);
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Κλείσιμο" />
      <View style={styles.sheet}>
        <ScrollView bounces={false} contentContainerStyle={styles.scroll}>
          <View>
            <DishImage uri={item.imageUrl} style={styles.hero} />
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Κλείσιμο">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
            </View>
            {diet ? <Text style={styles.diet}>{diet}</Text> : null}
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

            <View style={styles.grid}>
              {[
                ["Θερμίδες", `${item.calories}`, "kcal"],
                ["Πρωτεΐνη", formatGrams(item.proteinG), "g"],
                ["Υδατάνθρ.", formatGrams(item.carbsG), "g"],
                ["Λιπαρά", formatGrams(item.fatG), "g"],
              ].map(([label, value, unit]) => (
                <View key={label} style={styles.cell}>
                  <Text style={styles.cellValue}>{value}<Text style={styles.cellUnit}> {unit}</Text></Text>
                  <Text style={styles.cellLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>Μερίδα {item.portionWeightG} g · τα διατροφικά είναι ενδεικτικά</Text>

            <Text style={styles.section}>Αλλεργιογόνα</Text>
            <Text style={item.allergens.length ? styles.allergens : styles.note}>
              {item.allergens.length ? item.allergens.map(allergenLabel).join(", ") : "Δεν έχουν δηλωθεί — ρώτησε στο κατάστημα πριν παραγγείλεις."}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <QuantityControl quantity={quantity} itemName={item.name} onAdd={() => setQuantity((q) => q + 1)} onRemove={() => setQuantity((q) => Math.max(1, q - 1))} />
          <View style={{ flex: 1 }}>
            <PrimaryButton title={`Προσθήκη · ${formatPrice(item.priceCents * quantity)}`} onPress={add} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,20,14,0.45)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%",
    backgroundColor: theme.color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden",
  },
  scroll: { paddingBottom: 8 },
  hero: { width: "100%", height: 280 },
  close: {
    position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center",
  },
  closeText: { fontSize: 16, color: theme.color.textPrimary },
  content: { padding: 20, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { flex: 1, fontFamily: theme.typography.fontDisplay, fontSize: 24, lineHeight: 30, color: theme.color.textPrimary },
  price: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 20, lineHeight: 30, color: theme.color.textPrimary },
  diet: {
    alignSelf: "flex-start", fontFamily: theme.typography.fontBodyMedium, fontSize: 12, color: theme.color.accentStrong,
    backgroundColor: theme.color.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden",
  },
  description: { fontFamily: theme.typography.fontBody, fontSize: 15, lineHeight: 22, color: theme.color.textSecondary },
  grid: { flexDirection: "row", gap: 8, marginTop: 6 },
  cell: { flex: 1, backgroundColor: theme.color.surfaceRaised, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  cellValue: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 17, color: theme.color.textPrimary },
  cellUnit: { fontFamily: theme.typography.fontBody, fontSize: 12, color: theme.color.textMuted },
  cellLabel: { fontFamily: theme.typography.fontBody, fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  note: { fontFamily: theme.typography.fontBody, fontSize: 13, lineHeight: 19, color: theme.color.textMuted },
  section: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 15, color: theme.color.textPrimary, marginTop: 8 },
  allergens: { fontFamily: theme.typography.fontBodyMedium, fontSize: 14, color: theme.color.highlight },
  footer: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: theme.color.border, backgroundColor: theme.color.surface,
  },
});
