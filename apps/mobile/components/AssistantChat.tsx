import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, MenuItem } from "../api/client";
import { describeError } from "../api/errors";
import { MenuItemRow } from "./MenuItemRow";
import { Icon } from "./Icon";
import { theme } from "../theme";

interface Message {
  role: "user" | "assistant";
  content: string;
  dishes?: MenuItem[];
}

const MAX_HISTORY = 11; // odd: the conversation sent always starts with the customer

/** Chat with the AI assistant. Renders nothing unless the server has it enabled. */
export function AssistantChat() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    withAuth((token) => api.assistantConfig(token))
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, [withAuth]);

  if (!enabled) return null;

  const quantityOf = (id: string) => cart.lines.find((l) => l.item.id === id)?.quantity ?? 0;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    let history = [...messages, { role: "user" as const, content: text }].map(({ role, content }) => ({ role, content })).slice(-MAX_HISTORY);
    while (history.length && history[0].role !== "user") history = history.slice(1);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const r = await withAuth((token) => api.assistantChat(token, history));
      setMessages((m) => [...m, { role: "assistant", content: r.reply, dishes: r.dishes }]);
    } catch (e) {
      setError(
        describeError(e, {
          503: "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή. Οι προτάσεις παρακάτω λειτουργούν κανονικά.",
          429: "Πολλές ερωτήσεις σε λίγο χρόνο — δοκίμασε ξανά σε ένα λεπτό.",
        }),
      );
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ρώτα τον βοηθό</Text>
      {messages.length === 0 ? <Text style={styles.hint}>π.χ. «κάτι ελαφρύ με πολλή πρωτεΐνη, κάτω από 9 €»</Text> : null}
      {messages.map((m, i) => (
        <View key={i} style={m.role === "user" ? styles.userBubble : styles.botBubble}>
          <Text style={m.role === "user" ? styles.userText : styles.botText}>{m.content}</Text>
          {m.dishes?.map((d) => (
            <MenuItemRow key={d.id} item={d} quantity={quantityOf(d.id)} onAdd={() => cart.add(d)} onRemove={() => cart.decrement(d.id)} />
          ))}
        </View>
      ))}
      {busy ? <ActivityIndicator color={theme.color.accent} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Γράψε την ερώτησή σου…"
          placeholderTextColor={theme.color.textMuted}
          returnKeyType="send"
          maxLength={500}
          accessibilityLabel="Ερώτηση προς τον βοηθό"
        />
        <Pressable
          onPress={send}
          disabled={busy || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Αποστολή"
          style={[styles.send, (busy || !input.trim()) && styles.sendDisabled]}
        >
          <Icon name="arrowRight" size={18} strokeWidth={2} color={theme.color.surface} />
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>Απαντήσεις από AI, ενδεικτικές, όχι ιατρική συμβουλή. Οι συζητήσεις δεν αποθηκεύονται.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.space.lg, padding: theme.space.md, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceRaised, gap: theme.space.sm,
  },
  title: { fontFamily: theme.typography.fontDisplay, fontSize: theme.typography.scale.lg, color: theme.color.textPrimary },
  hint: { fontFamily: theme.typography.fontBody, fontSize: 13, color: theme.color.textMuted },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: theme.color.accent, borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  userText: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.surface, lineHeight: 20 },
  botBubble: { alignSelf: "stretch", backgroundColor: theme.color.background, borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingTop: 8 },
  botText: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.textPrimary, lineHeight: 21, paddingBottom: 8 },
  spinner: { alignSelf: "flex-start" },
  error: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.danger },
  inputRow: { flexDirection: "row", gap: theme.space.sm, alignItems: "center" },
  input: {
    flex: 1, fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.base, color: theme.color.textPrimary,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill, paddingHorizontal: theme.space.md, paddingVertical: 10,
    backgroundColor: theme.color.surface,
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.4 },
  disclaimer: { fontFamily: theme.typography.fontBody, fontSize: 12, color: theme.color.textMuted },
});
