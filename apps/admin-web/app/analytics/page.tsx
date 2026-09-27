"use client";

import { useCallback, useEffect, useState } from "react";
import { Analytics, api, describeError } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { useSession } from "../../lib/session";

const day = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("el-GR", { day: "numeric", month: "short" });
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AnalyticsPage() {
  const { withAuth, isAdmin } = useSession();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await withAuth((t) => api.analytics(t, days)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth, days]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return <main className="page"><p className="notice">Οι αναλύσεις είναι διαθέσιμες μόνο σε διαχειριστές.</p></main>;
  const maxDay = Math.max(1, ...(data?.series.map((s) => s.netCents) ?? [0]));
  const maxWeekday = Math.max(1, ...(data?.weekdays.map((w) => w.avgOrders) ?? [0]));
  const acc = data?.forecastAccuracy;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Αναλύσεις</h1>
          <p className="sub">Πωλήσεις, πελάτες, πιάτα που αγοράζονται μαζί, και πόσο πέφτουν μέσα οι προβλέψεις παραγωγής.</p>
        </div>
      </div>
      <div className="segmented">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`btn ${days === d ? "btn-primary" : "btn-secondary"}`} onClick={() => setDays(d)}>{d} ημέρες</button>
        ))}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!data && !error ? <div className="center">Υπολογισμός…</div> : null}
      {data ? (
        <>
          <div className="stats">
            <div className="stat"><b>{formatPrice(data.totals.netSalesCents)}</b><span>καθαρές πωλήσεις</span></div>
            <div className="stat"><b>{data.totals.orders}</b><span>παραγγελίες · μ.ό. {formatPrice(data.totals.averageOrderCents)}</span></div>
            <div className="stat"><b>{data.customers.active}</b><span>πελάτες · {data.customers.returning} επέστρεψαν · {data.customers.new} νέοι</span></div>
          </div>

          <p className="legend">Πωλήσεις ανά ημέρα</p>
          <div className="bars" role="img" aria-label="Καθαρές πωλήσεις ανά ημέρα">
            {data.series.map((s) => (
              <div key={s.date} className={`bar${s.netCents ? "" : " zero"}`} style={{ height: `${(s.netCents / maxDay) * 100}%` }} title={`${day(s.date)}: ${formatPrice(s.netCents)} · ${s.orders} παραγγελίες`} />
            ))}
          </div>
          <div className="axis"><span>{day(data.from)}</span><span>{day(data.to)}</span></div>

          <p className="legend" style={{ marginTop: 20 }}>Μέσος όρος παραγγελιών ανά ημέρα εβδομάδας</p>
          {data.weekdays.map((w) => (
            <div key={w.weekday} className="hbar">
              <span>{w.weekday}</span>
              <div className="track"><div className="fill" style={{ width: `${(w.avgOrders / maxWeekday) * 100}%` }} /></div>
              <span>{String(w.avgOrders).replace(".", ",")}</span>
            </div>
          ))}

          <p className="legend" style={{ marginTop: 20 }}>Top πιάτα</p>
          <ul className="rows">
            {data.topDishes.map((d) => <li key={d.name}><span>{d.name} · {d.quantity} μερίδες</span><span>{formatPrice(d.revenueCents)}</span></li>)}
          </ul>

          <p className="legend" style={{ marginTop: 20 }}>Αγοράζονται μαζί (ιδέες για combos)</p>
          {data.combos.length === 0 ? (
            <p className="muted">Χρειάζονται περισσότερες παραγγελίες με 2+ πιάτα για αξιόπιστα ζευγάρια.</p>
          ) : (
            <ul className="rows">
              {data.combos.map((c) => (
                <li key={`${c.aName}-${c.bName}`}>
                  <span><strong>{c.aName} + {c.bName}</strong> · μαζί σε {c.count} παραγγελίες ({pct(c.support)}) · το {pct(c.confidenceAB)} όσων παίρνουν το πρώτο παίρνει και το δεύτερο</span>
                  <span className="flag conf-high">{String(c.lift).replace(".", ",")}× πιο συχνά</span>
                </li>
              ))}
            </ul>
          )}

          <p className="legend" style={{ marginTop: 20 }}>Κανάλια</p>
          <div className="stats">
            <div className="stat"><b>{data.channels.viaGym}</b><span>μέσω γυμναστηρίων</span></div>
            <div className="stat"><b>{data.channels.employerSubsidised}</b><span>με εταιρική επιδότηση</span></div>
            <div className="stat"><b>{data.channels.mealPlan}</b><span>με συνδρομή</span></div>
            <div className="stat"><b>{data.channels.loyaltyReward}</b><span>με εξαργύρωση πόντων</span></div>
          </div>

          <p className="legend" style={{ marginTop: 20 }}>Προτάσεις «Τι να φάω σήμερα;»</p>
          {data.recommendations.shown ? (
            <p className="result">Από {data.recommendations.shown} πιάτα που προτάθηκαν, <strong>{data.recommendations.ordered} έγιναν παραγγελία</strong> την ίδια μέρα ({String(data.recommendations.conversion).replace(".", ",")}%). Αυτά τα δεδομένα θα εκπαιδεύσουν και θα αξιολογήσουν μελλοντικές εκδόσεις των προτάσεων.</p>
          ) : (
            <p className="muted">Δεν έχουν εμφανιστεί ακόμα προτάσεις σε αυτό το διάστημα.</p>
          )}

          <p className="legend" style={{ marginTop: 20 }}>Ακρίβεια προβλέψεων παραγωγής (4 εβδομάδες)</p>
          {acc ? (
            <p className="result">
              Μέση απόκλιση <strong>±{String(acc.meanAbsoluteError).replace(".", ",")} μερίδες</strong> ανά πιάτο και ημέρα
              {acc.meanAbsolutePercentError !== null ? ` (${String(acc.meanAbsolutePercentError).replace(".", ",")}%)` : ""} σε {acc.observations} προβλέψεις.{" "}
              {acc.bias > 0.5 ? "Τάση υπερεκτίμησης: κίνδυνος φύρας." : acc.bias < -0.5 ? "Τάση υποεκτίμησης: κίνδυνος να τελειώνουν πιάτα." : "Χωρίς συστηματική τάση."}
            </p>
          ) : (
            <p className="muted">Η μέτρηση ξεκινά μόλις υπάρξουν προβλέψεις (σελίδα «Παραγωγή») και πωλήσεις τις ίδιες ημέρες.</p>
          )}
        </>
      ) : null}
    </main>
  );
}
