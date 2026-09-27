"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Confidence, describeError, DishPlan, ProductionPlan, WasteReport } from "../../lib/api";
import { formatPrice, formatQty, parseDecimal } from "../../lib/format";

const qty = formatQty;
import { useSession } from "../../lib/session";

const CONFIDENCE: Record<Confidence, string> = { high: "Υψηλή βεβαιότητα", medium: "Μέτρια βεβαιότητα", low: "Χαμηλή βεβαιότητα", none: "Χωρίς δεδομένα" };
const athensToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" });
const plusDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

function DishRow({ dish, date, onDone }: { dish: DishPlan; date: string; onDone: (msg: string) => void }) {
  const { withAuth } = useSession();
  const [made, setMade] = useState("");
  const [left, setLeft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function record(kind: "made" | "left") {
    const n = parseDecimal(kind === "made" ? made : left);
    if (n === undefined || n < 1 || !Number.isInteger(n)) return setError("Γράψε ακέραιο αριθμό μερίδων.");
    setError(null);
    try {
      if (kind === "made") {
        const r = await withAuth((t) => api.recordProduction(t, { menuItemId: dish.menuItem.id, portions: n, date }));
        setMade("");
        onDone(`${dish.menuItem.name}: καταγράφηκαν ${n} μερίδες${r.deductedStock ? " και αφαιρέθηκαν τα υλικά από την αποθήκη" : " (χωρίς συνταγή — η αποθήκη δεν άλλαξε)"}.`);
      } else {
        await withAuth((t) => api.recordLeftover(t, { menuItemId: dish.menuItem.id, portions: n, reason: "unsold", date }));
        setLeft("");
        onDone(`${dish.menuItem.name}: καταγράφηκαν ${n} μερίδες που περίσσεψαν. Οι επόμενες προβλέψεις θα το λάβουν υπόψη.`);
      }
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <tr>
      <td className="cell-dish"><div className="dish">{dish.menuItem.name}</div>
        <div className="basis">{dish.basis}{dish.hasRecipe ? "" : " Χωρίς συνταγή: δεν υπολογίζονται υλικά."}</div>
        {error ? <div className="error" style={{ fontSize: 13 }}>{error}</div> : null}</td>
      <td className="cell-price"><div className="portions">{dish.recommended ?? "—"}</div><div className="muted" style={{ fontSize: 12 }}>μερίδες</div></td>
      <td className="cell-nutrition"><span className={`flag conf-${dish.confidence}`}>{CONFIDENCE[dish.confidence]}</span></td>
      <td className="cell-allergens" />
      <td className="cell-status" />
      <td className="cell-actions ops-actions">
        <div className="mini-form">
          <input aria-label={`Παρήχθησαν: ${dish.menuItem.name}`} inputMode="numeric" placeholder="μερ." value={made} onChange={(e) => setMade(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => record("made")}>Παρήχθησαν</button>
        </div>
        <div className="mini-form">
          <input aria-label={`Περίσσεψαν: ${dish.menuItem.name}`} inputMode="numeric" placeholder="μερ." value={left} onChange={(e) => setLeft(e.target.value)} />
          <button className="btn btn-quiet" onClick={() => record("left")}>Περίσσεψαν</button>
        </div>
      </td>
    </tr>
  );
}

export default function PlanningPage() {
  const { withAuth, isAdmin } = useSession();
  const today = athensToday();
  const [date, setDate] = useState(plusDays(today, 1));
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [waste, setWaste] = useState<WasteReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([withAuth((t) => api.planning(t, date)), withAuth((t) => api.wasteReport(t, 7))]);
      setPlan(p);
      setWaste(w);
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth, date]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return <main className="page"><p className="notice">Ο προγραμματισμός παραγωγής είναι διαθέσιμος μόνο σε διαχειριστές.</p></main>;

  const shortfalls = plan?.ingredients.filter((i) => i.shortfallG > 0) ?? [];
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Παραγωγή</h1>
          <p className="sub">Πόσες μερίδες να ετοιμάσεις, με βάση τις πωλήσεις των ίδιων ημερών. Κάθε πρόταση λέει σε τι βασίζεται.</p>
        </div>
      </div>

      <div className="segmented">
        <button className={`btn ${date === today ? "btn-primary" : "btn-secondary"}`} onClick={() => setDate(today)}>Σήμερα</button>
        <button className={`btn ${date === plusDays(today, 1) ? "btn-primary" : "btn-secondary"}`} onClick={() => setDate(plusDays(today, 1))}>Αύριο</button>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}
      {plan === null && !error ? <div className="center">Υπολογισμός πρόβλεψης…</div> : null}

      {plan ? (
        <>
          <h2 style={{ marginBottom: 8 }}>{plan.weekday} {new Date(`${plan.date}T12:00:00Z`).toLocaleDateString("el-GR", { day: "numeric", month: "long" })}</h2>
          {plan.openDaysSeen < 7 ? (
            <p className="notice">Υπάρχουν πωλήσεις μόνο από {plan.openDaysSeen} {plan.openDaysSeen === 1 ? "ημέρα" : "ημέρες"}. Οι προβλέψεις θα γίνονται πιο αξιόπιστες μετά από 2–3 εβδομάδες λειτουργίας.</p>
          ) : null}
          <div className="table-wrap">
            <table className="table menu-table ops-table">
              <thead><tr><th>ΠΙΑΤΟ</th><th>ΕΤΟΙΜΑΣΕ</th><th>ΒΕΒΑΙΟΤΗΤΑ</th><th /><th /><th>ΚΑΤΑΓΡΑΦΗ</th></tr></thead>
              <tbody>{plan.dishes.map((d) => <DishRow key={d.menuItem.id} dish={d} date={plan.date} onDone={(m) => { setNotice(m); void load(); }} />)}</tbody>
            </table>
          </div>

          <p className="legend" style={{ marginTop: 24 }}>Υλικά για αυτή την παραγωγή</p>
          {plan.ingredients.length === 0 ? (
            <p className="muted">Τα υλικά υπολογίζονται για πιάτα με συνταγή και πρόβλεψη.</p>
          ) : (
            <ul className="rows">
              {plan.ingredients.map((i) => (
                <li key={i.ingredientId}>
                  <span>{i.name} · χρειάζονται {qty(i.requiredG)} · απόθεμα {qty(Math.max(0, i.stockG))}</span>
                  {i.shortfallG > 0 ? <span className="flag flag-short">Λείπουν {qty(i.shortfallG)}</span> : <span className="flag conf-high">Αρκεί</span>}
                </li>
              ))}
            </ul>
          )}
          {shortfalls.length ? <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Λίστα αγορών: {shortfalls.map((i) => `${i.name} ${qty(i.shortfallG)}`).join(" · ")}</p> : null}
        </>
      ) : null}

      {waste ? (
        <>
          <p className="legend" style={{ marginTop: 28 }}>Φύρα τελευταίων 7 ημερών</p>
          <div className="stats">
            <div className="stat"><b>{formatPrice(waste.totals.dishCostCents + waste.totals.ingredientCostCents)}</b><span>συνολικό κόστος φύρας</span></div>
            <div className="stat"><b>{waste.totals.wastePercent === null ? "—" : `${String(waste.totals.wastePercent).replace(".", ",")}%`}</b><span>μερίδες που περίσσεψαν ({waste.totals.wastedPortions} από {waste.totals.producedPortions})</span></div>
          </div>
          {waste.dishes.length || waste.ingredients.length ? (
            <ul className="rows">
              {waste.dishes.map((d) => <li key={`d-${d.name}`}><span>{d.name} · {d.portions} μερίδες</span><span>{formatPrice(d.costCents)}</span></li>)}
              {waste.ingredients.map((i) => <li key={`i-${i.name}`}><span>{i.name} · {qty(i.grams)}</span><span>{formatPrice(i.costCents)}</span></li>)}
            </ul>
          ) : <p className="muted">Καμία φύρα αυτή την εβδομάδα.</p>}
        </>
      ) : null}
    </main>
  );
}
