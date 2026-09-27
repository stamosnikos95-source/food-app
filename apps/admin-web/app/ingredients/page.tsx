"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ALLERGENS, allergenLabel } from "@food-app/shared-types";
import { api, describeError, Ingredient, IngredientInput } from "../../lib/api";
import { formatPrice, parseDecimal, parseEurosToCents } from "../../lib/format";
import { useSession } from "../../lib/session";

type Draft = {
  name: string; price: string; kcal: string; protein: string; carbs: string; fat: string;
  allergens: string[]; isActive: boolean; reorder: string;
};
const EMPTY: Draft = { name: "", price: "", kcal: "", protein: "", carbs: "", fat: "", allergens: [], isActive: true, reorder: "" };
const comma = (n: number) => String(n).replace(".", ",");
const toDraft = (i: Ingredient): Draft => ({
  name: i.name, price: (i.costPerKgCents / 100).toFixed(2).replace(".", ","), kcal: comma(i.kcalPer100g),
  protein: comma(i.proteinPer100g), carbs: comma(i.carbsPer100g), fat: comma(i.fatPer100g),
  allergens: i.allergens, isActive: i.isActive,
  reorder: i.reorderLevelG != null ? comma(i.reorderLevelG / 1000) : "",
});

function fromDraft(d: Draft): IngredientInput | string {
  const cost = parseEurosToCents(d.price);
  const [kcal, protein, carbs, fat] = [d.kcal, d.protein, d.carbs, d.fat].map(parseDecimal);
  if (d.name.trim().length < 2) return "Γράψε το όνομα του υλικού.";
  if (cost === undefined || cost < 0) return "Η τιμή ανά κιλό δεν είναι έγκυρη.";
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined || [kcal, protein, carbs, fat].some((v) => v < 0)) {
    return "Συμπλήρωσε θερμίδες και macros ανά 100 g (γράψε 0 όπου δεν υπάρχει).";
  }
  if (protein + carbs + fat > 100) return "Πρωτεΐνη + υδατάνθρακες + λιπαρά δεν γίνεται να ξεπερνούν τα 100 g ανά 100 g.";
  const reorderKg = d.reorder.trim() ? parseDecimal(d.reorder) : null;
  if (reorderKg === undefined || (reorderKg !== null && reorderKg < 0)) return "Το όριο χαμηλού αποθέματος δεν είναι έγκυρο.";
  return { name: d.name.trim(), costPerKgCents: cost, kcalPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat, allergens: d.allergens, isActive: d.isActive,
    reorderLevelG: reorderKg === null ? null : Math.round(reorderKg * 1000) };
}

export default function IngredientsPage() {
  const { withAuth, isAdmin } = useSession();
  const [items, setItems] = useState<Ingredient[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await withAuth((t) => api.ingredients(t)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const set = (patch: Partial<Draft>) => setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const input = fromDraft(editing.draft);
    if (typeof input === "string") return setError(input);
    setSaving(true);
    setError(null);
    try {
      await withAuth((t) => (editing.id ? api.updateIngredient(t, editing.id, input) : api.createIngredient(t, input)));
      setEditing(null);
      await load();
    } catch (e) {
      setError(describeError(e, { 409: "Υπάρχει ήδη υλικό με αυτό το όνομα.", 400: "Κάποια τιμή δεν είναι έγκυρη." }));
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return <main className="page"><p className="notice">Τα υλικά και οι τιμές αγοράς είναι διαθέσιμα μόνο σε διαχειριστές.</p></main>;
  }

  const d = editing?.draft;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Υλικά</h1>
          <p className="sub">Τιμές αγοράς και διατροφικά ανά 100 g. Από εδώ υπολογίζονται οι συνταγές.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing({ id: null, draft: EMPTY }); setError(null); }}>Νέο υλικό</button>
      </div>

      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {editing && d ? (
        <form className="editor" onSubmit={save}>
          <h2>{editing.id ? "Επεξεργασία υλικού" : "Νέο υλικό"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="name">Όνομα</label>
              <input id="name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="π.χ. Στήθος κοτόπουλο" /></div>
            <div className="field"><label htmlFor="price">Τιμή αγοράς (€ / kg)</label>
              <input id="price" inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="8,50" /></div>
            <div className="field"><label htmlFor="kcal">Θερμίδες / 100 g</label>
              <input id="kcal" inputMode="decimal" value={d.kcal} onChange={(e) => set({ kcal: e.target.value })} /></div>
            <div className="field"><label htmlFor="p">Πρωτεΐνη / 100 g</label>
              <input id="p" inputMode="decimal" value={d.protein} onChange={(e) => set({ protein: e.target.value })} /></div>
            <div className="field"><label htmlFor="c">Υδατάνθρακες / 100 g</label>
              <input id="c" inputMode="decimal" value={d.carbs} onChange={(e) => set({ carbs: e.target.value })} /></div>
            <div className="field"><label htmlFor="f">Λιπαρά / 100 g</label>
              <input id="f" inputMode="decimal" value={d.fat} onChange={(e) => set({ fat: e.target.value })} /></div>
            <div className="field"><label htmlFor="reorder">Ειδοποίηση όταν πέσει κάτω από (kg)</label>
              <input id="reorder" inputMode="decimal" value={d.reorder} onChange={(e) => set({ reorder: e.target.value })} placeholder="προαιρετικό" /></div>
          </div>
          <fieldset style={{ border: 0, padding: 0, marginTop: 16 }}>
            <legend className="legend">Αλλεργιογόνα</legend>
            <div className="checks">
              {ALLERGENS.map((a) => (
                <label key={a.code} className="check">
                  <input type="checkbox" checked={d.allergens.includes(a.code)}
                    onChange={(e) => set({ allergens: e.target.checked ? [...d.allergens, a.code] : d.allergens.filter((x) => x !== a.code) })} />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={saving}>{saving ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setError(null); }}>Άκυρο</button>
            <label className="check" style={{ border: 0 }}>
              <input type="checkbox" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Σε χρήση
            </label>
          </div>
        </form>
      ) : null}

      {items === null && !error ? <div className="center">Φόρτωση υλικών…</div> : null}
      {items && items.length === 0 ? <p className="notice">Δεν υπάρχουν ακόμα υλικά. Ξεκίνα με όσα μπαίνουν στα πιάτα της ημέρας.</p> : null}
      {items && items.length > 0 ? (
        <div className="table-wrap">
          <table className="table menu-table">
            <thead><tr><th>ΥΛΙΚΟ</th><th>€ / KG</th><th>ΑΝΑ 100 G</th><th>ΑΛΛΕΡΓΙΟΓΟΝΑ</th><th>ΚΑΤΑΣΤΑΣΗ</th><th /></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.isActive ? "" : "inactive"}>
                  <td className="cell-dish"><div className="dish">{i.name}</div></td>
                  <td className="cell-price">{formatPrice(i.costPerKgCents)}</td>
                  <td className="cell-nutrition" style={{ whiteSpace: "nowrap", fontSize: 14 }}>{comma(i.kcalPer100g)} kcal<br />
                    <span className="muted">Π {comma(i.proteinPer100g)} · Υ {comma(i.carbsPer100g)} · Λ {comma(i.fatPer100g)}</span></td>
                  <td className="cell-allergens"><div className="chips">{i.allergens.length ? i.allergens.map((a) => <span key={a} className="chip">{allergenLabel(a)}</span>) : <span className="muted">—</span>}</div></td>
                  <td className="cell-status"><span className="muted">{i.isActive ? "Σε χρήση" : "Εκτός χρήσης"}</span></td>
                  <td className="cell-actions"><button className="btn btn-secondary" onClick={() => { setEditing({ id: i.id, draft: toDraft(i) }); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Επεξεργασία</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
