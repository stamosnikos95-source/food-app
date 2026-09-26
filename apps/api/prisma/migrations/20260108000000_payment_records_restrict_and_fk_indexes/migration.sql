-- Payment rows are financial records: deleting an order must fail rather
-- than silently erase its payment history.
ALTER TABLE "payments" DROP CONSTRAINT "payments_orderId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Postgres doesn't index foreign-key columns automatically. Both back the
-- per-customer queries (order history, payment reconciliation).
CREATE INDEX "orders_userId_idx" ON "orders"("userId");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
