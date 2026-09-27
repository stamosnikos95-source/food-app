"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, describeError, Gym, GymCode, GymFields, GymReport } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { qrSvg } from "../../lib/qr";
import { useSession } from "../../lib/session";

type Draft = { name: string; address: string; contactName: string; phone: string; email: string; discount: string; commission: string; deliveryEnabled: boolean; deliveryNote: string; isActive: boolean };
const EMPTY: Draft = { name: "", address: "", contactName: "", phone: "", email: "", discount: "10", commission: "5", deliveryEnabled: false, deliveryNote: "", isActive: true };
const toDraft = (g: GymFields): Draft => ({
  name: g.name, address: g.address ?? "", contactName: g.contactName ?? "", phone: g.phone ?? "", email: g.email ?? "",
  discount: String(g.discountPercent), commission: String(g.commissionPercent), deliveryEnabled: g.deliveryEnabled, deliveryNote: g.deliveryNote ?? "", isActive: g.isActive,
});
const thisMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" }).slice(0, 7);

function fromDraft(d: Draft): Partial<GymFields> | string {
  const discount = Number(d.discount), commission = Number(d.commission);
  if (d.name.trim().length < 2) return "Γράψε το όνομα του γυμναστηρίου.";
  if (!Number.isInteger(discount) || discount < 0 || discount > 30) return "Η έκπτωση μελών είναι 0–30%.";
  if (!Number.isInteger(commission) || commission < 0 || commission > 30) return "Η προμήθεια είναι 0–30%.";
  if (d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim())) return "Το email δεν είναι έγκυρο.";
  return {
    name: d.name.trim(), address: d.address.trim() || undefined, contactName: d.contactName.trim() || undefined, phone: d.phone.trim() || undefined,
    email: d.email.trim() || undefined, discountPercent: discount, commissionPercent: commission, deliveryEnabled: d.deliveryEnabled,
    deliveryNote: d.deliveryNote.trim() || undefined, isActive: d.isActive,
  } as Partial<GymFields>;
}

export default function GymsPage() {
  const { withAuth, isAdmin } = useSession();
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [draft, setDraft] = useState<{ id: string | null; d: Draft } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [report, setReport] = useState<GymReport | null>(null);
  const [month, setMonth] = useState(thisMonth());
  const [poster, setPoster] = useState<{ gym: Gym; code: GymCode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGyms(await withAuth((t) => api.gyms(t)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const input = fromDraft(draft.d);
    if (typeof input === "string") return setError(input);
    await run("save", async () => {
      await withAuth((t) => (draft.id ? api.updateGym(t, draft.id, input) : api.createGym(t, input)));
      setDraft(null);
    });
  }

  function printPoster(gym: Gym, code: GymCode) {
    setPoster({ gym, code });
    setTimeout(() => window.print(), 100);
  }

  if (!isAdmin) return <main className="page"><p className="notice">Τα γυμναστήρια είναι διαθέσιμα μόνο σε διαχειριστές.</p></main>;
  const set = (patch: Partial<Draft>) => setDraft((cur) => (cur ? { ...cur, d: { ...cur.d, ...patch } } : cur));

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Γυμναστήρια</h1>
          <p className="sub">Συνεργάτες με δικά τους QR: τα μέλη παραγγέλνουν με έκπτωση, και το γυμναστήριο παίρνει προμήθεια από όσα φέρνει.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setDraft({ id: null, d: EMPTY }); setError(null); }}>Νέο γυμναστήριο</button>
      </div>

      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {draft ? (
        <form className="editor" onSubmit={save}>
          <h2>{draft.id ? "Επεξεργασία γυμναστηρίου" : "Νέο γυμναστήριο"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="gname">Όνομα</label><input id="gname" value={draft.d.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="field"><label htmlFor="disc">Έκπτωση μελών (%)</label><input id="disc" inputMode="numeric" value={draft.d.discount} onChange={(e) => set({ discount: e.target.value })} /></div>
            <div className="field"><label htmlFor="comm">Προμήθεια γυμναστηρίου (%)</label><input id="comm" inputMode="numeric" value={draft.d.commission} onChange={(e) => set({ commission: e.target.value })} /></div>
            <div className="field"><label htmlFor="contact">Υπεύθυνος</label><input id="contact" value={draft.d.contactName} onChange={(e) => set({ contactName: e.target.value })} /></div>
            <div className="field"><label htmlFor="phone">Τηλέφωνο</label><input id="phone" inputMode="tel" value={draft.d.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="gemail">Email</label><input id="gemail" type="email" value={draft.d.email} onChange={(e) => set({ email: e.target.value })} /></div>
            <div className="field wide"><label htmlFor="addr">Διεύθυνση</label><input id="addr" value={draft.d.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div className="field wide"><label htmlFor="note">Ώρες παράδοσης (αν παραδίδετε εκεί)</label><input id="note" value={draft.d.deliveryNote} onChange={(e) => set({ deliveryNote: e.target.value })} placeholder="π.χ. Στην υποδοχή, 13:00 και 19:00" /></div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy === "save"}>{busy === "save" ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>Άκυρο</button>
            <label className="check" style={{ border: 0 }}><input type="checkbox" checked={draft.d.deliveryEnabled} onChange={(e) => set({ deliveryEnabled: e.target.checked })} /> Παράδοση στο γυμναστήριο</label>
            <label className="check" style={{ border: 0 }}><input type="checkbox" checked={draft.d.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Ενεργό</label>
          </div>
        </form>
      ) : null}

      {report ? (
        <section className="editor">
          <h2>{report.gym.name} · {report.month}</h2>
          <div className="stats" style={{ marginTop: 12 }}>
            <div className="stat"><b>{report.orders}</b><span>παραγγελίες ({report.deliveredToGym} με παράδοση)</span></div>
            <div className="stat"><b>{formatPrice(report.netSalesCents)}</b><span>καθαρές πωλήσεις</span></div>
            <div className="stat"><b>{formatPrice(report.commissionCents)}</b><span>προμήθεια ({report.gym.commissionPercent}%) που οφείλεται</span></div>
            <div className="stat"><b>{formatPrice(report.memberDiscountCents)}</b><span>εκπτώσεις μελών ({report.gym.discountPercent}%)</span></div>
          </div>
          <ul className="rows">
            {report.codes.map((c) => <li key={c.id}><span>{c.label}{c.isActive ? "" : " (ανακλήθηκε)"}</span><span>{c.scans} σκαναρίσματα · {c.orders} παραγγελίες</span></li>)}
          </ul>
          <div className="editor-actions"><button className="btn btn-secondary" onClick={() => setReport(null)}>Κλείσιμο</button></div>
        </section>
      ) : null}

      {gyms === null && !error ? <div className="center">Φόρτωση γυμναστηρίων…</div> : null}
      {gyms && gyms.length === 0 && !draft ? <p className="notice">Δεν υπάρχουν ακόμα συνεργαζόμενα γυμναστήρια.</p> : null}
      {gyms?.map((g) => (
        <section key={g.id} className="editor" style={{ opacity: g.isActive ? 1 : 0.6 }}>
          <h2>{g.name}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            −{g.discountPercent}% για μέλη · προμήθεια {g.commissionPercent}% · {g.orders} παραγγελίες
            {g.deliveryEnabled ? ` · παράδοση: ${g.deliveryNote ?? "ναι"}` : ""}{g.isActive ? "" : " · ανενεργό"}
          </p>
          <div className="editor-actions">
            <button className="btn btn-secondary" onClick={() => setDraft({ id: g.id, d: toDraft(g) })}>Επεξεργασία</button>
            <input aria-label="Μήνας αναφοράς" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ font: "inherit", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10 }} />
            <button className="btn btn-quiet" onClick={() => run(`r-${g.id}`, async () => setReport(await withAuth((t) => api.gymReport(t, g.id, month))))}>Αναφορά</button>
          </div>
          {g.codes.map((c) => (
            <div key={c.id} className="code-card" style={{ opacity: c.isActive ? 1 : 0.5 }}>
              <div className="qr" aria-label={`QR για ${c.label}`} dangerouslySetInnerHTML={{ __html: qrSvg(c.url) }} />
              <div className="meta">
                <strong>{c.label}</strong>{c.isActive ? "" : " · ανακλήθηκε"}
                <div className="muted" style={{ fontSize: 13, wordBreak: "break-all" }}>{c.url}</div>
                <div className="muted" style={{ fontSize: 13 }}>{c.scans} σκαναρίσματα</div>
                <div className="editor-actions" style={{ marginTop: 8 }}>
                  {c.isActive ? <button className="btn btn-secondary" onClick={() => printPoster(g, c)}>Εκτύπωση αφίσας</button> : null}
                  <button className="btn btn-quiet" disabled={busy === c.id}
                    onClick={() => (c.isActive && !window.confirm(`Ανάκληση του QR «${c.label}»; Όσοι το σκανάρουν δεν θα παίρνουν πια την έκπτωση.`)) ? undefined : run(c.id, () => withAuth((t) => api.setGymCode(t, c.id, !c.isActive)))}>
                    {c.isActive ? "Ανάκληση" : "Επανενεργοποίηση"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <form className="search-row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); const label = (labels[g.id] ?? "").trim(); if (label.length < 2) return setError("Γράψε πού θα μπει το QR (π.χ. Υποδοχή)."); void run(`c-${g.id}`, async () => { await withAuth((t) => api.createGymCode(t, g.id, label)); setLabels({ ...labels, [g.id]: "" }); }); }}>
            <input aria-label="Σημείο νέου QR" placeholder="Νέο QR για… (π.χ. Υποδοχή)" value={labels[g.id] ?? ""} onChange={(e) => setLabels({ ...labels, [g.id]: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy === `c-${g.id}`}>Νέο QR</button>
          </form>
        </section>
      ))}

      {poster ? (
        <div className="poster" aria-hidden="true">
          <h1>{poster.gym.name}</h1>
          <p>Σκάναρε και παράγγειλε το γεύμα σου{poster.gym.discountPercent > 0 ? ` · −${poster.gym.discountPercent}% για μέλη` : ""}</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg(poster.code.url) }} />
          {poster.gym.deliveryEnabled && poster.gym.deliveryNote ? <p>Παράδοση: {poster.gym.deliveryNote}</p> : null}
        </div>
      ) : null}
    </main>
  );
}
