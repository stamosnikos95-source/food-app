"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, CompanyDetail, CompanyFields, CompanyStatement, CompanySummary, describeError } from "../../lib/api";
import { formatPrice, parseEurosToCents } from "../../lib/format";
import { useSession } from "../../lib/session";

type Draft = { name: string; vatNumber: string; billingEmail: string; contactName: string; phone: string; address: string; allowance: string; isActive: boolean };
const EMPTY: Draft = { name: "", vatNumber: "", billingEmail: "", contactName: "", phone: "", address: "", allowance: "", isActive: true };
const toDraft = (c: CompanyFields): Draft => ({
  name: c.name, vatNumber: c.vatNumber, billingEmail: c.billingEmail, contactName: c.contactName ?? "", phone: c.phone ?? "",
  address: c.address ?? "", allowance: (c.dailyAllowanceCents / 100).toFixed(2).replace(".", ","), isActive: c.isActive,
});

function fromDraft(d: Draft): Partial<CompanyFields> | string {
  const cents = d.allowance.trim() ? parseEurosToCents(d.allowance) : 0;
  if (d.name.trim().length < 2) return "Γράψε την επωνυμία.";
  if (!/^\s*(EL)?[\d\s]{9,11}\s*$/i.test(d.vatNumber)) return "Ο ΑΦΜ έχει 9 ψηφία.";
  if (!/^\S+@\S+\.\S+$/.test(d.billingEmail.trim())) return "Γράψε ένα έγκυρο email τιμολόγησης.";
  if (cents === undefined || cents < 0 || cents > 10000) return "Η ημερήσια επιδότηση πρέπει να είναι από 0 έως 100 €.";
  return {
    name: d.name.trim(), vatNumber: d.vatNumber.trim(), billingEmail: d.billingEmail.trim(),
    contactName: d.contactName.trim() || undefined, phone: d.phone.trim() || undefined, address: d.address.trim() || undefined,
    dailyAllowanceCents: cents, isActive: d.isActive,
  } as Partial<CompanyFields>;
}

const thisMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" }).slice(0, 7);

export default function CompaniesPage() {
  const { withAuth, isAdmin } = useSession();
  const [list, setList] = useState<CompanySummary[] | null>(null);
  const [draft, setDraft] = useState<{ id: string | null; d: Draft } | null>(null);
  const [open, setOpen] = useState<CompanyDetail | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [statement, setStatement] = useState<CompanyStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await withAuth((t) => api.companies(t)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const fail = (e: unknown) =>
    setError(describeError(e, { 400: "Ο ΑΦΜ δεν είναι έγκυρος (λάθος ψηφίο ελέγχου) ή κάποιο πεδίο λείπει.", 404: "Δεν υπάρχει λογαριασμός με αυτό το email — ο εργαζόμενος πρέπει πρώτα να εγγραφεί στην εφαρμογή." }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const input = fromDraft(draft.d);
    if (typeof input === "string") return setError(input);
    setBusy(true);
    setError(null);
    try {
      const saved = await withAuth((t) => (draft.id ? api.updateCompany(t, draft.id, input) : api.createCompany(t, input)));
      setDraft(null);
      setOpen(saved);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function openCompany(id: string) {
    setError(null);
    setStatement(null);
    try {
      setOpen(await withAuth((t) => api.company(t, id)));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      fail(e);
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!open || !memberEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setOpen(await withAuth((t) => api.addMember(t, open.id, memberEmail.trim())));
      setMemberEmail("");
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string, email: string) {
    if (!open || !window.confirm(`Αφαίρεση του ${email} από την ${open.name}; Από εδώ και πέρα δεν θα παίρνει επιδότηση.`)) return;
    try {
      setOpen(await withAuth((t) => api.removeMember(t, open.id, userId)));
      await load();
    } catch (e) {
      fail(e);
    }
  }

  async function loadStatement() {
    if (!open) return;
    setError(null);
    try {
      setStatement(await withAuth((t) => api.statement(t, open.id, month)));
    } catch (e) {
      fail(e);
    }
  }

  if (!isAdmin) return <main className="page"><p className="notice">Οι εταιρικοί πελάτες είναι διαθέσιμοι μόνο σε διαχειριστές.</p></main>;

  const set = (patch: Partial<Draft>) => setDraft((cur) => (cur ? { ...cur, d: { ...cur.d, ...patch } } : cur));
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Εταιρείες</h1>
          <p className="sub">Εταιρικοί πελάτες: η εταιρεία πληρώνει ημερήσια επιδότηση ανά εργαζόμενο και την τιμολογείς κάθε μήνα.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setDraft({ id: null, d: EMPTY }); setOpen(null); setError(null); }}>Νέα εταιρεία</button>
      </div>

      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {draft ? (
        <form className="editor" onSubmit={save}>
          <h2>{draft.id ? "Επεξεργασία εταιρείας" : "Νέα εταιρεία"}</h2>
          <div className="grid">
            <div className="field wide"><label htmlFor="cname">Επωνυμία</label><input id="cname" value={draft.d.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="field"><label htmlFor="vat">ΑΦΜ</label><input id="vat" inputMode="numeric" value={draft.d.vatNumber} onChange={(e) => set({ vatNumber: e.target.value })} placeholder="9 ψηφία" /></div>
            <div className="field"><label htmlFor="bill">Email τιμολόγησης</label><input id="bill" type="email" value={draft.d.billingEmail} onChange={(e) => set({ billingEmail: e.target.value })} /></div>
            <div className="field"><label htmlFor="allow">Επιδότηση / εργαζόμενο / ημέρα (€)</label><input id="allow" inputMode="decimal" value={draft.d.allowance} onChange={(e) => set({ allowance: e.target.value })} placeholder="π.χ. 8,00" /></div>
            <div className="field"><label htmlFor="contact">Υπεύθυνος</label><input id="contact" value={draft.d.contactName} onChange={(e) => set({ contactName: e.target.value })} /></div>
            <div className="field"><label htmlFor="phone">Τηλέφωνο</label><input id="phone" inputMode="tel" value={draft.d.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div className="field wide"><label htmlFor="addr">Διεύθυνση</label><input id="addr" value={draft.d.address} onChange={(e) => set({ address: e.target.value })} /></div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>Άκυρο</button>
            <label className="check" style={{ border: 0 }}><input type="checkbox" checked={draft.d.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Ενεργή</label>
          </div>
        </form>
      ) : null}

      {open && !draft ? (
        <section className="editor">
          <h2>{open.name}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            ΑΦΜ {open.vatNumber} · {open.billingEmail} · επιδότηση {formatPrice(open.dailyAllowanceCents)} / εργαζόμενο / ημέρα{open.isActive ? "" : " · ανενεργή"}
          </p>
          <div className="editor-actions no-print">
            <button className="btn btn-secondary" onClick={() => setDraft({ id: open.id, d: toDraft(open) })}>Επεξεργασία στοιχείων</button>
            <button className="btn btn-quiet" onClick={() => { setOpen(null); setStatement(null); }}>Κλείσιμο</button>
          </div>

          <p className="legend no-print" style={{ marginTop: 20 }}>Εργαζόμενοι ({open.members.length})</p>
          <ul className="rows no-print">
            {open.members.map((m) => (
              <li key={m.userId}>
                <span style={{ wordBreak: "break-all" }}>{m.email}</span>
                <button className="btn btn-quiet" onClick={() => removeMember(m.userId, m.email)}>Αφαίρεση</button>
              </li>
            ))}
          </ul>
          <form className="search-row no-print" onSubmit={addMember} style={{ marginTop: 12 }}>
            <input aria-label="Email εργαζομένου" type="email" placeholder="Email εργαζομένου (με λογαριασμό στην εφαρμογή)" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            <button className="btn btn-secondary" disabled={busy}>Προσθήκη</button>
          </form>

          <p className="legend" style={{ marginTop: 24 }}>Μηνιαία κατάσταση για τιμολόγηση</p>
          <div className="search-row no-print">
            <input aria-label="Μήνας" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn btn-secondary" onClick={loadStatement}>Προβολή</button>
            {statement ? <button className="btn btn-quiet" onClick={() => window.print()}>Εκτύπωση</button> : null}
          </div>
          {statement ? (
            <>
              <p className="result">
                <strong>{statement.company.name}</strong> · ΑΦΜ {statement.company.vatNumber} · {statement.month}<br />
                {statement.totals.orders} παραγγελίες · <strong>Χρέωση εταιρείας: {formatPrice(statement.totals.companyCents)}</strong> · πλήρωσαν οι εργαζόμενοι {formatPrice(statement.totals.employeeCents)}
              </p>
              {statement.orders.length ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table statement">
                    <thead><tr><th>ΗΜΕΡΟΜΗΝΙΑ</th><th>ΕΡΓΑΖΟΜΕΝΟΣ</th><th>ΣΥΝΟΛΟ</th><th>ΕΤΑΙΡΕΙΑ</th></tr></thead>
                    <tbody>
                      {statement.orders.map((o) => (
                        <tr key={o.id}>
                          <td>{new Date(o.createdAt).toLocaleString("el-GR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</td>
                          <td style={{ wordBreak: "break-all" }}>{o.employee}</td>
                          <td>{formatPrice(o.totalPriceCents)}</td>
                          <td>{formatPrice(o.companyPaidCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {list === null && !error ? <div className="center">Φόρτωση εταιρειών…</div> : null}
      {list && list.length === 0 && !draft ? <p className="notice">Δεν υπάρχουν ακόμα εταιρικοί πελάτες.</p> : null}
      {list && list.length > 0 ? (
        <div className="table-wrap">
          <table className="table menu-table">
            <thead><tr><th>ΕΤΑΙΡΕΙΑ</th><th>ΑΥΤΟΝ ΤΟΝ ΜΗΝΑ</th><th>ΕΠΙΔΟΤΗΣΗ</th><th>ΕΡΓΑΖΟΜΕΝΟΙ</th><th>ΚΑΤΑΣΤΑΣΗ</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={c.isActive ? "" : "inactive"}>
                  <td className="cell-dish"><div className="dish">{c.name}</div><div className="muted" style={{ fontSize: 13 }}>ΑΦΜ {c.vatNumber}</div></td>
                  <td className="cell-price">{formatPrice(c.monthToDateCents)}</td>
                  <td className="cell-nutrition" style={{ fontSize: 14 }}>{formatPrice(c.dailyAllowanceCents)} / εργαζόμενο / ημέρα</td>
                  <td className="cell-allergens"><span className="muted" style={{ fontSize: 14 }}>{c.members} εργαζόμενοι</span></td>
                  <td className="cell-status"><span className="muted" style={{ fontSize: 14 }}>{c.isActive ? "Ενεργή" : "Ανενεργή"}</span></td>
                  <td className="cell-actions"><button className="btn btn-secondary" onClick={() => openCompany(c.id)}>Άνοιγμα</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
