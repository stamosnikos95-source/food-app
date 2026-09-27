"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, describeError, InventoryItem, InventoryOverview } from "../../lib/api";
import { formatPrice, formatQty, parseDecimal, parseEurosToCents } from "../../lib/format";
import { useSession } from "../../lib/session";

type Action = "purchase" | "waste" | "count";
const TITLES: Record<Action, string> = { purchase: "Παραλαβή", waste: "Φύρα", count: "Απογραφή" };
const WASTE_REASONS = [
  { value: "expired", label: "Έληξε" }, { value: "spoiled", label: "Χάλασε" }, { value: "overproduction", label: "Υπερπαραγωγή" },
  { value: "prep_loss", label: "Απώλεια στην προετοιμασία" }, { value: "other", label: "Άλλο" },
];
const qty = formatQty;
const day = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("el-GR", { weekday: "short", day: "numeric", month: "short" });

export default function InventoryPage() {
  const { withAuth, isAdmin } = useSession();
  const [data, setData] = useState<InventoryOverview | null>(null);
  const [form, setForm] = useState<{ action: Action; item: InventoryItem } | null>(null);
  const [kg, setKg] = useState("");
  const [price, setPrice] = useState("");
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await withAuth((t) => api.inventory(t)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  function start(action: Action, item: InventoryItem) {
    setForm({ action, item });
    setKg(action === "count" ? String(Math.max(0, item.stockG) / 1000).replace(".", ",") : "");
    setPrice(action === "purchase" ? (item.costPerKgCents / 100).toFixed(2).replace(".", ",") : "");
    setExpires("");
    setNote("");
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const amountKg = parseDecimal(kg);
    if (amountKg === undefined || amountKg < 0 || (form.action !== "count" && amountKg === 0)) return setError("Γράψε ποσότητα σε κιλά, π.χ. 2,5");
    const grams = Math.round(amountKg * 1000);
    setBusy(true);
    setError(null);
    try {
      const id = form.item.id;
      if (form.action === "purchase") {
        const cents = price.trim() ? parseEurosToCents(price) : undefined;
        if (price.trim() && cents === undefined) throw new Error("price");
        await withAuth((t) => api.purchase(t, { ingredientId: id, quantityG: grams, costPerKgCents: cents, expiresOn: expires || undefined, note: note || undefined }));
        setNotice(`Παραλαβή ${qty(grams)} ${form.item.name}.${cents !== undefined && cents !== form.item.costPerKgCents ? " Η τιμή ανά κιλό ενημερώθηκε — οι συνταγές υπολογίζονται με τη νέα τιμή." : ""}`);
      } else if (form.action === "waste") {
        await withAuth((t) => api.ingredientWaste(t, { ingredientId: id, quantityG: grams, reason, note: note || undefined }));
        setNotice(`Καταγράφηκε φύρα ${qty(grams)} ${form.item.name}.`);
      } else {
        const r = await withAuth((t) => api.stockCount(t, { ingredientId: id, countedG: grams, note: note || undefined }));
        setNotice(r.adjustedByG === 0 ? `Η απογραφή ταιριάζει με το σύστημα (${qty(grams)}).` : `Διόρθωση ${r.adjustedByG > 0 ? "+" : "−"}${qty(Math.abs(r.adjustedByG))} στο ${form.item.name}.`);
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message === "price" ? "Η τιμή δεν είναι έγκυρη (π.χ. 8,50)." : describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return <main className="page"><p className="notice">Η αποθήκη είναι διαθέσιμη μόνο σε διαχειριστές.</p></main>;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Αποθήκη</h1>
          <p className="sub">Κάθε αλλαγή καταγράφεται ως κίνηση: παραλαβές, κατανάλωση από την παραγωγή, φύρα και απογραφές.</p>
        </div>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {form ? (
        <form className="editor" onSubmit={submit}>
          <h2>{TITLES[form.action]} · {form.item.name}</h2>
          <p className="muted" style={{ marginTop: 4 }}>Απόθεμα στο σύστημα: {qty(form.item.stockG)}</p>
          <div className="grid" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="kg">{form.action === "count" ? "Μέτρησα (kg)" : "Ποσότητα (kg)"}</label>
              <input id="kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="π.χ. 2,5" autoFocus /></div>
            {form.action === "purchase" ? (
              <>
                <div className="field"><label htmlFor="price">Τιμή αγοράς (€ / kg)</label>
                  <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                <div className="field"><label htmlFor="exp">Λήγει (προαιρετικό)</label>
                  <input id="exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
              </>
            ) : null}
            {form.action === "waste" ? (
              <div className="field"><label htmlFor="reason">Αιτία</label>
                <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {WASTE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select></div>
            ) : null}
            <div className="field wide"><label htmlFor="note">Σημείωση (προαιρετικό)</label>
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Καταγραφή…" : "Καταγραφή"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Άκυρο</button>
          </div>
        </form>
      ) : null}

      {data ? (
        <div className="stats">
          <div className="stat"><b>{formatPrice(data.totals.valueCents)}</b><span>αξία αποθέματος</span></div>
          <div className="stat"><b>{data.totals.low}</b><span>σε χαμηλό απόθεμα</span></div>
          <div className="stat"><b>{data.totals.expiring}</b><span>λήγουν σε 2 μέρες</span></div>
        </div>
      ) : null}

      {data === null && !error ? <div className="center">Φόρτωση αποθήκης…</div> : null}
      {data && data.items.length === 0 ? <p className="notice">Πρόσθεσε πρώτα υλικά στη σελίδα «Υλικά».</p> : null}
      {data && data.items.length > 0 ? (
        <div className="table-wrap">
          <table className="table menu-table ops-table">
            <thead><tr><th>ΥΛΙΚΟ</th><th>ΑΠΟΘΕΜΑ</th><th>ΑΞΙΑ</th><th>ΕΙΔΟΠΟΙΗΣΕΙΣ</th><th /><th /></tr></thead>
            <tbody>
              {data.items.filter((i) => i.isActive || i.stockG !== 0).map((i) => (
                <tr key={i.id}>
                  <td className="cell-dish"><div className="dish">{i.name}</div></td>
                  <td className="cell-price">{qty(Math.max(0, i.stockG))}</td>
                  <td className="cell-nutrition" style={{ fontSize: 14 }}>{formatPrice(i.valueCents)}{i.reorderLevelG != null ? <span className="muted"> · όριο {qty(i.reorderLevelG)}</span> : null}</td>
                  <td className="cell-allergens">
                    {i.needsCount ? <span className="flag flag-count">Χρειάζεται απογραφή</span> : null}
                    {i.low ? <span className="flag flag-low">Χαμηλό απόθεμα</span> : null}
                    {i.expiringOn ? <span className="flag flag-exp">Λήγει {day(i.expiringOn)}</span> : null}
                  </td>
                  <td className="cell-status" />
                  <td className="cell-actions ops-actions">
                    <button className="btn btn-secondary" onClick={() => start("purchase", i)}>Παραλαβή</button>
                    <button className="btn btn-quiet" onClick={() => start("waste", i)}>Φύρα</button>
                    <button className="btn btn-quiet" onClick={() => start("count", i)}>Απογραφή</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
