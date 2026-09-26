"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError, SalesSummary } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { useSession } from "../../lib/session";

const STATUS_LABELS: Record<string, string> = {
  pending: "Νέες", confirmed: "Σε προετοιμασία", ready: "Έτοιμες", completed: "Παραλήφθηκαν", cancelled: "Ακυρώθηκαν",
};

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReportsPage() {
  const { withAuth } = useSession();
  const [day, setDay] = useState(todayInput);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Local midnight to midnight: "today" means the shop's day, not UTC's.
    const [y, m, d] = day.split("-").map(Number);
    const from = new Date(y, m - 1, d);
    const to = new Date(y, m - 1, d + 1);
    try {
      setSummary(await withAuth((t) => api.summary(t, from, to)));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [day, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Αναφορές</h1>
          <p className="sub">Πωλήσεις ανά ημέρα. Οι ακυρωμένες παραγγελίες δεν μετράνε στον τζίρο.</p>
        </div>
        <div className="field">
          <label htmlFor="day">Ημέρα</label>
          <input id="day" type="date" value={day} max={todayInput()} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {summary ? (
        <>
          <div className="stats">
            <div className="stat"><div className="eyebrow">ΠΑΡΑΓΓΕΛΙΕΣ</div><div className="value">{summary.orders}</div></div>
            <div className="stat"><div className="eyebrow">ΤΖΙΡΟΣ</div><div className="value">{formatPrice(summary.revenueCents)}</div></div>
            <div className="stat"><div className="eyebrow">ΜΕΣΗ ΠΑΡΑΓΓΕΛΙΑ</div><div className="value">{formatPrice(summary.averageOrderCents)}</div></div>
            <div className="stat"><div className="eyebrow">ΠΛΗΡΩΜΕΣ ONLINE</div><div className="value">{formatPrice(summary.paidOnlineCents)}</div></div>
          </div>
          <div className="two">
            <section className="panel">
              <h2>Δημοφιλέστερα πιάτα</h2>
              {summary.topItems.length === 0 ? <p className="muted">Καμία πώληση αυτή την ημέρα.</p> : (
                <ol className="rows">{summary.topItems.map((t) => <li key={t.menuItemId}><span>{t.name}</span><strong>{t.quantity}</strong></li>)}</ol>
              )}
            </section>
            <section className="panel">
              <h2>Ανά κατάσταση</h2>
              <ul className="rows">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <li key={status}><span>{label}</span><strong>{summary.byStatus[status as keyof typeof summary.byStatus] ?? 0}</strong></li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : !error ? <div className="center">Φόρτωση…</div> : null}
    </main>
  );
}
