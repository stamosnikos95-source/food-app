"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ALLERGENS, allergenLabel } from "@food-app/shared-types";
import { AdminMenuItem, api, describeError, MenuItemInput } from "../../lib/api";
import { formatPrice, parseDecimal, parseEurosToCents } from "../../lib/format";
import { useSession } from "../../lib/session";

type Draft = Record<"name" | "description" | "category" | "price" | "portion" | "calories" | "protein" | "carbs" | "fat", string> & {
  allergens: string[];
  isActive: boolean;
};

const EMPTY: Draft = { name: "", description: "", category: "", price: "", portion: "", calories: "",
  protein: "", carbs: "", fat: "", allergens: [], isActive: true };

const toDraft = (i: AdminMenuItem): Draft => ({
  name: i.name, description: i.description ?? "", category: i.category ?? "",
  price: (i.priceCents / 100).toFixed(2).replace(".", ","), portion: String(i.portionWeightG),
  calories: String(i.calories), protein: String(i.proteinG).replace(".", ","),
  carbs: String(i.carbsG).replace(".", ","), fat: String(i.fatG).replace(".", ","),
  allergens: i.allergens, isActive: i.isActive,
});

function fromDraft(d: Draft): MenuItemInput | string {
  const priceCents = parseEurosToCents(d.price);
  const numbers = {
    portionWeightG: parseDecimal(d.portion), calories: parseDecimal(d.calories),
    proteinG: parseDecimal(d.protein), carbsG: parseDecimal(d.carbs), fatG: parseDecimal(d.fat),
  };
  if (d.name.trim().length < 2) return "Γράψε όνομα πιάτου.";
  if (priceCents === undefined || priceCents < 0) return "Η τιμή δεν είναι έγκυρη (π.χ. 8,50).";
  if (Object.values(numbers).some((n) => n === undefined || n < 0)) return "Συμπλήρωσε μερίδα, θερμίδες και μακροθρεπτικά με αριθμούς.";
  return {
    name: d.name.trim(),
    description: d.description.trim() || undefined,
    category: d.category.trim() || undefined,
    priceCents,
    portionWeightG: Math.round(numbers.portionWeightG!),
    calories: Math.round(numbers.calories!),
    proteinG: Math.round(numbers.proteinG! * 10) / 10,
    carbsG: Math.round(numbers.carbsG! * 10) / 10,
    fatG: Math.round(numbers.fatG! * 10) / 10,
    allergens: d.allergens,
    isActive: d.isActive,
  };
}

export default function MenuPage() {
  const { withAuth, isAdmin } = useSession();
  const [items, setItems] = useState<AdminMenuItem[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await withAuth((t) => api.menu(t)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const input = fromDraft(editing.draft);
    if (typeof input === "string") return setError(input);
    setSaving(true);
    setError(null);
    try {
      await withAuth((t) => (editing.id ? api.updateMenuItem(t, editing.id, input) : api.createMenuItem(t, input)));
      setEditing(null);
      await load();
    } catch (e) {
      setError(describeError(e, { 400: "Κάποιο πεδίο δεν είναι έγκυρο — έλεγξε τις τιμές." }));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: AdminMenuItem) {
    try {
      await withAuth((t) => api.updateMenuItem(t, item.id, { isActive: !item.isActive }));
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  }

  const d = editing?.draft;
  const macroKcal = d ? Math.round(4 * (parseDecimal(d.protein) ?? 0) + 4 * (parseDecimal(d.carbs) ?? 0) + 9 * (parseDecimal(d.fat) ?? 0)) : 0;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Μενού</h1>
          <p className="sub">Τιμές, διατροφικά στοιχεία και αλλεργιογόνα όπως τα βλέπουν οι πελάτες.</p>
        </div>
        {isAdmin && !editing ? (
          <button className="btn btn-primary" onClick={() => setEditing({ id: null, draft: EMPTY })}>Νέο πιάτο</button>
        ) : null}
      </div>

      <p className="notice">
        Τα αρχικά πιάτα, τα διατροφικά τους και τα αλλεργιογόνα είναι <strong>δείγματα</strong>. Πριν την κυκλοφορία
        πρέπει να αντικατασταθούν με τα πραγματικά — τα αλλεργιογόνα είναι νομική υποχρέωση (Καν. ΕΕ 1169/2011).
      </p>
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {editing && d ? (
        <form className="editor" onSubmit={save}>
          <h2>{editing.id ? "Επεξεργασία πιάτου" : "Νέο πιάτο"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="name">Όνομα</label>
              <input id="name" value={d.name} onChange={(e) => set({ name: e.target.value })} required /></div>
            <div className="field wide"><label htmlFor="desc">Περιγραφή</label>
              <textarea id="desc" value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div className="field"><label htmlFor="price">Τιμή (€)</label>
              <input id="price" inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="8,50" /></div>
            <div className="field"><label htmlFor="portion">Μερίδα (g)</label>
              <input id="portion" inputMode="numeric" value={d.portion} onChange={(e) => set({ portion: e.target.value })} /></div>
            <div className="field"><label htmlFor="category">Κατηγορία</label>
              <input id="category" value={d.category} onChange={(e) => set({ category: e.target.value })} placeholder="π.χ. Bowls" /></div>
            <div className="field"><label htmlFor="kcal">Θερμίδες (kcal)</label>
              <input id="kcal" inputMode="numeric" value={d.calories} onChange={(e) => set({ calories: e.target.value })} /></div>
            <div className="field"><label htmlFor="p">Πρωτεΐνη (g)</label>
              <input id="p" inputMode="decimal" value={d.protein} onChange={(e) => set({ protein: e.target.value })} /></div>
            <div className="field"><label htmlFor="c">Υδατάνθρακες (g)</label>
              <input id="c" inputMode="decimal" value={d.carbs} onChange={(e) => set({ carbs: e.target.value })} /></div>
            <div className="field"><label htmlFor="f">Λιπαρά (g)</label>
              <input id="f" inputMode="decimal" value={d.fat} onChange={(e) => set({ fat: e.target.value })} /></div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Από τα μακροθρεπτικά βγαίνουν ≈ {macroKcal} kcal (4·πρωτ. + 4·υδατ. + 9·λιπ.) — έλεγχος για τυπογραφικά λάθη.
          </p>
          <fieldset style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
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
              <input type="checkbox" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
              Εμφανίζεται στο μενού
            </label>
          </div>
        </form>
      ) : null}

      {items === null && !error ? <div className="center">Φόρτωση μενού…</div> : null}
      {items ? (
        <div className="table-wrap">
          <table className="table menu-table">
            <thead>
              <tr><th>ΠΙΑΤΟ</th><th>ΤΙΜΗ</th><th>ΔΙΑΤΡΟΦΙΚΑ</th><th>ΑΛΛΕΡΓΙΟΓΟΝΑ</th><th>ΚΑΤΑΣΤΑΣΗ</th>{isAdmin ? <th /> : null}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.isActive ? "" : "inactive"}>
                  <td className="cell-dish"><div className="dish">{item.name}</div><div className="muted" style={{ fontSize: 13 }}>{item.category ?? ""}</div></td>
                  <td className="cell-price">{formatPrice(item.priceCents)}</td>
                  <td className="cell-nutrition" style={{ whiteSpace: "nowrap", fontSize: 14 }}>{item.calories} kcal · {item.portionWeightG}g<br />
                    <span className="muted">Π {item.proteinG} · Υ {item.carbsG} · Λ {item.fatG}</span></td>
                  <td className="cell-allergens"><div className="chips">{item.allergens.length ? item.allergens.map((a) => <span key={a} className="chip">{allergenLabel(a)}</span>) : <span className="muted">—</span>}</div></td>
                  <td className="cell-status">
                    {isAdmin ? (
                      <button className="btn btn-quiet" onClick={() => toggleActive(item)} aria-label={`${item.isActive ? "Απόσυρση" : "Επαναφορά"}: ${item.name}`}>
                        {item.isActive ? "● Ενεργό" : "○ Ανενεργό"}
                      </button>
                    ) : item.isActive ? "Ενεργό" : "Ανενεργό"}
                  </td>
                  {isAdmin ? (
                    <td className="cell-actions"><button className="btn btn-secondary" onClick={() => { setEditing({ id: item.id, draft: toDraft(item) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Επεξεργασία</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
