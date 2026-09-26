"use client";

import { useCallback, useEffect, useState } from "react";
import { allergenLabel, OrderStatus, pickupCode } from "@food-app/shared-types";
import { AdminOrder, api, describeError } from "../lib/api";
import { formatPrice, formatTime, minutesSince, upperGreek } from "../lib/format";
import { useSession } from "../lib/session";

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "pending", title: "Νέες" },
  { status: "confirmed", title: "Σε προετοιμασία" },
  { status: "ready", title: "Έτοιμες για παραλαβή" },
];

const LATE_AFTER_MIN: Partial<Record<OrderStatus, number>> = { pending: 5, confirmed: 25, ready: 30 };
const POLL_MS = 15_000;

export default function KitchenBoard() {
  const { withAuth } = useSession();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await withAuth((t) => api.activeOrders(t)));
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(describeError(e));
    }
  }, [withAuth]);

  useEffect(() => {
    load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  async function move(order: AdminOrder, next: OrderStatus) {
    if (next === "cancelled" && !window.confirm(`Ακύρωση της παραγγελίας #${pickupCode(order.id)};`)) return;
    setBusyId(order.id);
    try {
      await withAuth((t) => api.setOrderStatus(t, order.id, next));
      await load();
    } catch (e) {
      setError(describeError(e, { 409: "Η παραγγελία άλλαξε στο μεταξύ ή έχει πληρωθεί online — ανανεώθηκε η λίστα." }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{upperGreek(new Date().toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" }))}</div>
          <h1>Παραγγελίες</h1>
          <p className="sub">
            Ενημερώνεται αυτόματα κάθε 15″{updatedAt ? ` · τελευταία ${formatTime(new Date(updatedAt).toISOString())}` : ""}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>Ανανέωση</button>
      </div>

      {error ? <p className="notice" role="alert">{error}</p> : null}
      {orders === null && !error ? <div className="center">Φόρτωση παραγγελιών…</div> : null}

      {orders ? (
        <div className="board">
          {COLUMNS.map((column) => {
            const list = orders.filter((o) => o.status === column.status);
            return (
              <section key={column.status} aria-label={column.title}>
                <div className="column-head">
                  <h2>{column.title}</h2>
                  <span className="count">{list.length}</span>
                </div>
                {list.length === 0 ? <div className="empty">Καμία παραγγελία</div> : null}
                {list.map((order) => {
                  const minutes = minutesSince(order.createdAt, now);
                  const late = minutes >= (LATE_AFTER_MIN[order.status] ?? Infinity);
                  const busy = busyId === order.id;
                  return (
                    <article key={order.id} className="ticket">
                      <div className="ticket-head">
                        <span className="code">#{pickupCode(order.id)}</span>
                        <span className={`age${late ? " late" : ""}`}>
                          {formatTime(order.createdAt)} · πριν {minutes}′
                        </span>
                      </div>
                      <ul className="lines">
                        {order.items.map((line) => (
                          <li key={line.id}>
                            <span className="qty">{line.quantity}×</span>
                            {line.menuItem.name}
                            {line.menuItem.allergens.length > 0 ? (
                              <span className="allergy">{line.menuItem.allergens.map(allergenLabel).join(", ")}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <div className="ticket-meta">
                        <span>{formatPrice(order.totalPriceCents)} · {order.customerEmail}</span>
                        <span className={`badge${order.paidOnline ? " paid" : ""}`}>
                          {order.paidOnline ? "Πληρώθηκε online" : "Πληρωμή στο κατάστημα"}
                        </span>
                      </div>
                      <div className="actions">
                        {order.status === "pending" ? (
                          <>
                            <button className="btn btn-primary" disabled={busy} onClick={() => move(order, "confirmed")}>Αποδοχή</button>
                            {!order.paidOnline ? (
                              <button className="btn btn-danger" disabled={busy} onClick={() => move(order, "cancelled")}>Απόρριψη</button>
                            ) : null}
                          </>
                        ) : null}
                        {order.status === "confirmed" ? (
                          <button className="btn btn-primary" disabled={busy} onClick={() => move(order, "ready")}>Έτοιμη</button>
                        ) : null}
                        {order.status === "ready" ? (
                          <>
                            <button className="btn btn-primary" disabled={busy} onClick={() => move(order, "completed")}>Παραλήφθηκε</button>
                            {!order.paidOnline ? (
                              <button className="btn btn-danger" disabled={busy} onClick={() => move(order, "cancelled")}>Δεν ήρθε</button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
