"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminCustomer, AdminCustomerDetail, api, CustomerPage, describeError, StaffRole } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { useSession } from "../../lib/session";

const ROLE_LABEL: Record<string, string> = { customer: "Πελάτης", staff: "Προσωπικό", admin: "Διαχειριστής" };
const STATUS_LABEL: Record<string, string> = {
  pending: "Σε αναμονή", confirmed: "Σε προετοιμασία", ready: "Έτοιμη", completed: "Παραδόθηκε", cancelled: "Ακυρώθηκε",
};
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short", year: "numeric" }) : "—");

function RoleBadge({ role }: { role: string }) {
  return <span className={`role role-${role}`}>{ROLE_LABEL[role] ?? role}</span>;
}

export default function CustomersPage() {
  const { withAuth, isAdmin } = useSession();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomerPage | null>(null);
  const [open, setOpen] = useState<AdminCustomerDetail | null>(null);
  const [role, setRole] = useState<StaffRole>("customer");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await withAuth((t) => api.customers(t, query, page)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth, query, page]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function openCustomer(c: AdminCustomer) {
    setError(null);
    setNotice(null);
    try {
      const detail = await withAuth((t) => api.customer(t, c.id));
      setOpen(detail);
      setRole(detail.role as StaffRole);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function saveRole() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await withAuth((t) => api.setRole(t, open.id, role));
      setOpen(updated);
      setNotice(`Ο ρόλος του ${updated.email} έγινε «${ROLE_LABEL[updated.role]}». Ισχύει από την επόμενη ανανέωση της σύνδεσής του (έως 15 λεπτά).`);
      await load();
    } catch (e) {
      setError(describeError(e, { 400: "Δεν μπορείς να αφαιρέσεις τον δικό σου ρόλο διαχειριστή.", 409: "Πρέπει να μείνει τουλάχιστον ένας διαχειριστής." }));
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  if (!isAdmin) return <main className="page"><p className="notice">Η διαχείριση πελατών είναι διαθέσιμη μόνο σε διαχειριστές.</p></main>;

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Πελάτες</h1>
          <p className="sub">Λογαριασμοί, παραγγελίες και ρόλοι. Σωματικά στοιχεία και αλλεργίες δεν εμφανίζονται εδώ — μένουν μόνο στον λογαριασμό του πελάτη.</p>
        </div>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

      {open ? (
        <section className="editor">
          <h2>{open.email}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Μέλος από {date(open.createdAt)} · {open.orders} παραγγελίες · {formatPrice(open.spentCents)}
            {open.company ? ` · ${open.company.name}` : ""}
          </p>
          <div className="grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="role">Ρόλος</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                <option value="customer">Πελάτης</option>
                <option value="staff">Προσωπικό (βλέπει παραγγελίες κουζίνας)</option>
                <option value="admin">Διαχειριστής (πλήρης πρόσβαση)</option>
              </select>
            </div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-primary" disabled={busy || role === open.role} onClick={saveRole}>{busy ? "Αποθήκευση…" : "Αλλαγή ρόλου"}</button>
            <button className="btn btn-secondary" onClick={() => { setOpen(null); setNotice(null); }}>Κλείσιμο</button>
          </div>
          <p className="legend" style={{ marginTop: 20 }}>Πρόσφατες παραγγελίες</p>
          {open.recentOrders.length === 0 ? <p className="muted">Καμία παραγγελία ακόμα.</p> : (
            <ul className="rows">
              {open.recentOrders.map((o) => (
                <li key={o.id}>
                  <span>{date(o.createdAt)} · {o.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(", ")}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{formatPrice(o.totalPriceCents)} · {STATUS_LABEL[o.status] ?? o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <form className="search-row" onSubmit={submitSearch}>
        <input aria-label="Αναζήτηση με email" placeholder="Αναζήτηση με email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-secondary">Αναζήτηση</button>
      </form>

      {data === null && !error ? <div className="center">Φόρτωση πελατών…</div> : null}
      {data && data.customers.length === 0 ? <p className="notice">Δεν βρέθηκαν πελάτες.</p> : null}
      {data && data.customers.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table menu-table">
              <thead><tr><th>ΠΕΛΑΤΗΣ</th><th>ΡΟΛΟΣ</th><th>ΠΑΡΑΓΓΕΛΙΕΣ</th><th>ΤΕΛΕΥΤΑΙΑ</th><th>ΕΓΓΡΑΦΗ</th><th /></tr></thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-dish"><div className="dish" style={{ fontSize: 16, wordBreak: "break-all" }}>{c.email}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{c.company?.name ?? ""}</div></td>
                    <td className="cell-price"><RoleBadge role={c.role} /></td>
                    <td className="cell-nutrition" style={{ fontSize: 14 }}>{c.orders} παραγγελίες · {formatPrice(c.spentCents)}</td>
                    <td className="cell-allergens"><span className="muted" style={{ fontSize: 14 }}>Τελευταία: {date(c.lastOrderAt)}</span></td>
                    <td className="cell-status"><span className="muted" style={{ fontSize: 14 }}>Από {date(c.createdAt)}</span></td>
                    <td className="cell-actions"><button className="btn btn-secondary" onClick={() => openCustomer(c)}>Άνοιγμα</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted">{data.total} πελάτες · σελίδα {data.page} από {pages}</span>
            <button className="btn btn-quiet" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Προηγούμενη</button>
            <button className="btn btn-quiet" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Επόμενη</button>
          </div>
        </>
      ) : null}
    </main>
  );
}
