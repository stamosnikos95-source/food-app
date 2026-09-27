"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { allergenLabel } from "@food-app/shared-types";
import { AdminMenuItem, api, describeError, Ingredient, RecipeInput, RecipeView } from "../../lib/api";
import { formatPrice, parseDecimal } from "../../lib/format";
import { useSession } from "../../lib/session";

type Line = { ingredientId: string; grams: string };
type Draft = { name: string; yieldPortions: string; menuItemId: string; notes: string; lines: Line[] };
const EMPTY: Draft = { name: "", yieldPortions: "1", menuItemId: "", notes: "", lines: [{ ingredientId: "", grams: "" }] };
const comma = (n: number) => String(n).replace(".", ",");

const toDraft = (r: RecipeView): Draft => ({
  name: r.name,
  yieldPortions: String(r.yieldPortions),
  menuItemId: r.menuItem?.id ?? "",
  notes: r.notes ?? "",
  lines: r.lines.map((l) => ({ ingredientId: l.ingredientId, grams: comma(l.grams) })),
});

function fromDraft(d: Draft): RecipeInput | string {
  const portions = Number(d.yieldPortions);
  if (d.name.trim().length < 2) return "Γράψε όνομα συνταγής.";
  if (!Number.isInteger(portions) || portions < 1) return "Οι μερίδες πρέπει να είναι ακέραιος αριθμός, 1 ή περισσότερες.";
  const filled = d.lines.filter((l) => l.ingredientId || l.grams.trim());
  if (filled.length === 0) return "Πρόσθεσε τουλάχιστον ένα υλικό.";
  const lines = [];
  for (const l of filled) {
    const grams = parseDecimal(l.grams);
    if (!l.ingredientId) return "Διάλεξε υλικό σε κάθε γραμμή.";
    if (grams === undefined || grams <= 0) return "Γράψε γραμμάρια (> 0) σε κάθε γραμμή.";
    lines.push({ ingredientId: l.ingredientId, grams });
  }
  if (new Set(lines.map((l) => l.ingredientId)).size !== lines.length) return "Κάθε υλικό μπαίνει μία φορά — ένωσε τα γραμμάρια.";
  return { name: d.name.trim(), yieldPortions: portions, menuItemId: d.menuItemId || null, notes: d.notes.trim() || undefined, lines };
}

function FoodCost({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  const tone = value <= 30 ? "fc-good" : value <= 35 ? "fc-warn" : "fc-bad";
  return <span className={`fc ${tone}`}>Food cost {comma(value)}%</span>;
}

export default function RecipesPage() {
  const { withAuth, isAdmin } = useSession();
  const [recipes, setRecipes] = useState<RecipeView[] | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<AdminMenuItem[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, i, m] = await Promise.all([
        withAuth((t) => api.recipes(t)),
        withAuth((t) => api.ingredients(t)),
        withAuth((t) => api.menu(t)),
      ]);
      setRecipes(r);
      setIngredients(i);
      setDishes(m);
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const set = (patch: Partial<Draft>) => setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur));
  const setLine = (index: number, patch: Partial<Line>) =>
    setEditing((cur) => cur ? { ...cur, draft: { ...cur.draft, lines: cur.draft.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) } } : cur);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const input = fromDraft(editing.draft);
    if (typeof input === "string") return setError(input);
    setBusy(true);
    setError(null);
    try {
      const saved = await withAuth((t) => (editing.id ? api.updateRecipe(t, editing.id, input) : api.createRecipe(t, input)));
      setEditing(null);
      setNotice(`Αποθηκεύτηκε: «${saved.name}» — ${saved.costing.perPortion.calories} kcal και ${formatPrice(saved.costing.perPortion.costCents)} κόστος ανά μερίδα.`);
      await load();
    } catch (e) {
      setError(describeError(e, { 409: "Αυτό το πιάτο έχει ήδη συνταγή.", 400: "Κάποια τιμή δεν είναι έγκυρη." }));
    } finally {
      setBusy(false);
    }
  }

  async function applyToMenu(r: RecipeView) {
    if (!r.menuItem) return;
    const ok = window.confirm(
      `Θα ενημερωθούν θερμίδες, macros και μερίδα του «${r.menuItem.name}» με βάση τη συνταγή. ` +
        "Τα αλλεργιογόνα των υλικών θα προστεθούν σε όσα έχουν ήδη δηλωθεί (δεν αφαιρείται κανένα). Συνέχεια;",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await withAuth((t) => api.applyRecipe(t, r.id));
      setNotice(`Ενημερώθηκε το πιάτο «${r.menuItem.name}» στο μενού των πελατών.`);
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return <main className="page"><p className="notice">Οι συνταγές και το κόστος είναι διαθέσιμα μόνο σε διαχειριστές.</p></main>;
  }

  const d = editing?.draft;
  const linkedElsewhere = new Set((recipes ?? []).filter((r) => r.id !== editing?.id && r.menuItem).map((r) => r.menuItem!.id));
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Συνταγές</h1>
          <p className="sub">Διατροφικά και κόστος ανά μερίδα, από τα υλικά. Food cost επί της τιμής χωρίς ΦΠΑ.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing({ id: null, draft: EMPTY }); setError(null); setNotice(null); }} disabled={ingredients.length === 0}>
          Νέα συνταγή
        </button>
      </div>

      {ingredients.length === 0 && recipes !== null ? <p className="notice">Για να φτιάξεις συνταγή, πρόσθεσε πρώτα υλικά στη σελίδα «Υλικά».</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {editing && d ? (
        <form className="editor" onSubmit={save}>
          <h2>{editing.id ? "Επεξεργασία συνταγής" : "Νέα συνταγή"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="rname">Όνομα</label>
              <input id="rname" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="π.χ. Bowl κοτόπουλο — παρτίδα" /></div>
            <div className="field"><label htmlFor="yield">Βγάζει μερίδες</label>
              <input id="yield" inputMode="numeric" value={d.yieldPortions} onChange={(e) => set({ yieldPortions: e.target.value })} /></div>
            <div className="field"><label htmlFor="dish">Πιάτο στο μενού</label>
              <select id="dish" value={d.menuItemId} onChange={(e) => set({ menuItemId: e.target.value })}>
                <option value="">— Χωρίς σύνδεση —</option>
                {dishes.map((m) => (
                  <option key={m.id} value={m.id} disabled={linkedElsewhere.has(m.id)}>
                    {m.name}{linkedElsewhere.has(m.id) ? " (έχει ήδη συνταγή)" : ""}
                  </option>
                ))}
              </select></div>
          </div>

          <p className="legend" style={{ marginTop: 16 }}>Υλικά (γραμμάρια για όλη την παρτίδα)</p>
          {d.lines.map((line, index) => (
            <div key={index} className="line-row">
              <select aria-label={`Υλικό ${index + 1}`} value={line.ingredientId} onChange={(e) => setLine(index, { ingredientId: e.target.value })}>
                <option value="">Διάλεξε υλικό…</option>
                {ingredients.filter((i) => i.isActive || i.id === line.ingredientId).map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <input aria-label={`Γραμμάρια ${index + 1}`} inputMode="decimal" placeholder="g" value={line.grams} onChange={(e) => setLine(index, { grams: e.target.value })} />
              <button type="button" className="btn btn-quiet" aria-label={`Αφαίρεση γραμμής ${index + 1}`}
                onClick={() => set({ lines: d.lines.length > 1 ? d.lines.filter((_, i) => i !== index) : [{ ingredientId: "", grams: "" }] })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={() => set({ lines: [...d.lines, { ingredientId: "", grams: "" }] })}>+ Υλικό</button>

          <div className="field wide" style={{ marginTop: 16 }}><label htmlFor="notes">Σημειώσεις (προαιρετικά)</label>
            <input id="notes" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="π.χ. βάρος ωμών υλικών" /></div>

          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setError(null); }}>Άκυρο</button>
          </div>
        </form>
      ) : null}

      {recipes === null && !error ? <div className="center">Φόρτωση συνταγών…</div> : null}
      {recipes && recipes.length > 0 ? (
        <div className="table-wrap">
          <table className="table menu-table">
            <thead><tr><th>ΣΥΝΤΑΓΗ</th><th>FOOD COST</th><th>ΑΝΑ ΜΕΡΙΔΑ</th><th>ΑΛΛΕΡΓΙΟΓΟΝΑ</th><th>ΠΑΡΤΙΔΑ</th><th /></tr></thead>
            <tbody>
              {recipes.map((r) => {
                const p = r.costing.perPortion;
                return (
                  <tr key={r.id}>
                    <td className="cell-dish"><div className="dish">{r.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{r.menuItem ? `→ ${r.menuItem.name} · ${formatPrice(r.menuItem.priceCents)}` : "Χωρίς πιάτο"}</div></td>
                    <td className="cell-price"><FoodCost value={r.foodCostPercent} /></td>
                    <td className="cell-nutrition" style={{ fontSize: 14 }}>{p.calories} kcal · {p.weightG} g · κόστος {formatPrice(p.costCents)}<br />
                      <span className="muted">Π {comma(p.proteinG)} · Υ {comma(p.carbsG)} · Λ {comma(p.fatG)}</span></td>
                    <td className="cell-allergens"><div className="chips">{r.costing.allergens.length ? r.costing.allergens.map((a) => <span key={a} className="chip">{allergenLabel(a)}</span>) : <span className="muted">—</span>}</div></td>
                    <td className="cell-status"><span className="muted">{r.yieldPortions} {r.yieldPortions === 1 ? "μερίδα" : "μερίδες"}</span></td>
                    <td className="cell-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {r.menuItem ? <button className="btn btn-quiet" disabled={busy} onClick={() => applyToMenu(r)}>Στο μενού</button> : null}
                      <button className="btn btn-secondary" onClick={() => { setEditing({ id: r.id, draft: toDraft(r) }); setError(null); setNotice(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Επεξεργασία</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
