"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminSubscription, api, describeError, Plan } from "../../lib/api";
import { formatPrice, parseEurosToCents } from "../../lib/format";
import { useSession } from "../../lib/session";

type Draft = { name: string; description: string; meals: string; days: string; price: string; maxMeal: string; isActive: boolean };
const EMPTY: Draft = { name: "", description: "", meals: "10", days: "30", price: "", maxMeal: "", isActive: true };
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toDraft = (p: Plan): Draft => ({
  name: p.name, description: p.description ?? "", meals: String(p.mealsPerPeriod), days: String(p.periodDays),
  price: euros(p.priceCents), maxMeal: euros(p.maxMealPriceCents), isActive: p.isActive,
});
const STATUS_LABEL = { pending: "Αναμονή πληρωμής", active: "Ενεργή", cancelled: "Ακυρωμένη" } as const;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" }) : "—");

function fromDraft(d: Draft): Omit<Plan, "id"> | string {
  const meals = Number(d.meals), days = Number(d.days);
  const price = parseEurosToCents(d.price), maxMeal = parseEurosToCents(d.maxMeal);
  if (d.name.trim().length < 2) return "Γράψε όνομα πλάνου.";
  if (!Number.isInteger(meals) || meals < 1 || meals > 100) return "Τα γεύματα πρέπει να είναι 1–100.";
  if (!Number.isInteger(days) || days < 1 || days > 92) return "Η διάρκεια πρέπει να είναι 1–92 ημέρες.";
  if (price === undefined || price < 0) return "Η τιμή δεν είναι έγκυρη.";
  if (maxMeal === undefined || maxMeal < 1) return "Γράψε μέχρι πόσο καλύπτει κάθε γεύμα.";
  return { name: d.name.trim(), description: d.description.trim() || null, mealsPerPeriod: meals, periodDays: days, priceCents: price, maxMealPriceCents: maxMeal, isActive: d.isActive };
}

export default function SubscriptionsPage() {
  const { withAuth, isAdmin } = useSession();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [filter, setFilter] = useState<"pending" | "active" | "">("pending");
  const [draft, setDraft] = useState<{ id: string | null; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([withAuth((t) => api.plans(t)), withAuth((t) => api.subscriptions(t, filter || undefined))]);
      setPlans(p);
      setSubs(s);
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth, filter]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const input = fromDraft(draft.d);
    if (typeof input === "string") return setError(input);
    setBusy("plan");
    setError(null);
    try {
      await withAuth((t) => (draft.id ? api.updatePlan(t, draft.id, input) : api.createPlan(t, input)));
      setDraft(null);
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  async function act(sub: AdminSubscription, action: "activate" | "cancel") {
    const question = action === "activate"
      ? `${sub.status === "active" ? "Ανανέωση" : "Ενεργοποίηση"} για ${sub.user.email}: εισπράχθηκαν ${formatPrice(sub.plan.priceCents)}; Ξεκινά νέα περίοδος ${sub.plan.periodDays} ημερών με ${sub.plan.mealsPerPeriod} γεύματα (τα αχρησιμοποίητα δεν μεταφέρονται).`
      : `Ακύρωση της συνδρομής του ${sub.user.email};`;
    if (!window.confirm(question)) return;
    setBusy(sub.id);
    setError(null);
    try {
      await withAuth((t) => (action === "activate" ? api.activateSubscription(t, sub.id) : api.cancelSubscription(t, sub.id)));
      setNotice(action === "activate" ? `Η συνδρομή του ${sub.user.email} είναι ενεργή.` : `Η συνδρομή του ${sub.user.email} ακυρώθηκε.`);
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!isAdmin) return <main className="page"><p className="notice">Οι συνδρομές είναι διαθέσιμες μόνο σε διαχειριστές.</p></main>;
  const set = (patch: Partial<Draft>) => setDraft((cur) => (cur ? { ...cur, d: { ...cur.d, ...patch } } : cur));

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Συνδρομές</h1>
          <p className="sub">Πλάνα γευμάτων και αιτήσεις πελατών. Μέχρι να ενεργοποιηθούν οι πληρωμές με κάρτα, η συνδρομή ενεργοποιείται εδώ όταν εισπράξεις στο κατάστημα.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setDraft({ id: null, d: EMPTY }); setError(null); }}>Νέο πλάνο</button>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {draft ? (
        <form className="editor" onSubmit={savePlan}>
          <h2>{draft.id ? "Επεξεργασία πλάνου" : "Νέο πλάνο"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="pname">Όνομα</label><input id="pname" value={draft.d.name} onChange={(e) => set({ name: e.target.value })} placeholder="π.χ. Μηνιαίο 10 γευμάτων" /></div>
            <div className="field"><label htmlFor="meals">Γεύματα ανά περίοδο</label><input id="meals" inputMode="numeric" value={draft.d.meals} onChange={(e) => set({ meals: e.target.value })} /></div>
            <div className="field"><label htmlFor="days">Διάρκεια (ημέρες)</label><input id="days" inputMode="numeric" value={draft.d.days} onChange={(e) => set({ days: e.target.value })} /></div>
            <div className="field"><label htmlFor="price">Τιμή (€)</label><input id="price" inputMode="decimal" value={draft.d.price} onChange={(e) => set({ price: e.target.value })} placeholder="75,00" /></div>
            <div className="field"><label htmlFor="max">Καλύπτει πιάτα έως (€)</label><input id="max" inputMode="decimal" value={draft.d.maxMeal} onChange={(e) => set({ maxMeal: e.target.value })} placeholder="9,00" /></div>
            <div className="field wide"><label htmlFor="desc">Περιγραφή (προαιρετικό)</label><input id="desc" value={draft.d.description} onChange={(e) => set({ description: e.target.value })} /></div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy === "plan"}>{busy === "plan" ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>Άκυρο</button>
            <label className="check" style={{ border: 0 }}><input type="checkbox" checked={draft.d.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Διαθέσιμο σε πελάτες</label>
          </div>
        </form>
      ) : null}

      <p className="legend">Πλάνα</p>
      {plans && plans.length === 0 ? <p className="notice">Δεν υπάρχουν πλάνα. Φτιάξε το πρώτο με το «Νέο πλάνο».</p> : null}
      {plans && plans.length > 0 ? (
        <ul className="rows" style={{ marginBottom: 24 }}>
          {plans.map((p) => (
            <li key={p.id} style={{ opacity: p.isActive ? 1 : 0.55 }}>
              <span><strong>{p.name}</strong> · {p.mealsPerPeriod} γεύματα / {p.periodDays} ημ. · {formatPrice(p.priceCents)} · έως {formatPrice(p.maxMealPriceCents)}/γεύμα{p.isActive ? "" : " · μη διαθέσιμο"}</span>
              <button className="btn btn-quiet" onClick={() => setDraft({ id: p.id, d: toDraft(p) })}>Επεξεργασία</button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="segmented">
        {([["pending", "Αιτήσεις"], ["active", "Ενεργές"], ["", "Όλες"]] as const).map(([value, label]) => (
          <button key={label} className={`btn ${filter === value ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {subs.length === 0 ? <p className="muted">Καμία συνδρομή σε αυτή την κατηγορία.</p> : (
        <ul className="rows">
          {subs.map((s) => (
            <li key={s.id} style={{ flexWrap: "wrap", gap: 8 }}>
              <span style={{ wordBreak: "break-all" }}>
                <strong>{s.user.email}</strong> · {s.plan.name} · {STATUS_LABEL[s.status]}
                {s.status === "active" ? ` · απομένουν ${s.mealsRemaining} · έως ${date(s.currentPeriodEnd)}` : ""}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                {s.status !== "cancelled" ? (
                  <button className="btn btn-primary" disabled={busy === s.id} onClick={() => act(s, "activate")}>{s.status === "active" ? "Ανανέωση (πληρώθηκε)" : "Πληρώθηκε · Ενεργοποίηση"}</button>
                ) : null}
                {s.status !== "cancelled" ? <button className="btn btn-quiet" disabled={busy === s.id} onClick={() => act(s, "cancel")}>Ακύρωση</button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
