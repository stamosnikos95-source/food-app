import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Payment } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckoutSessionInfo, PAYMENT_PROVIDER, PaymentProvider } from "./providers/payment-provider";

const CHECKOUT_TTL_MS = 30 * 60 * 1000; // Stripe's minimum session lifetime.
const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly config: ConfigService,
  ) {}

  getPublicConfig() {
    return { onlinePaymentsEnabled: this.provider.mode !== "disabled", mode: this.provider.mode };
  }

  /** Opens a hosted checkout for one of the caller's unpaid orders. */
  async startCheckout(userId: string, orderId: string): Promise<{ checkoutUrl: string }> {
    if (this.provider.mode === "disabled") {
      throw new ServiceUnavailableException("Online payments are not configured");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } }, user: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) throw new ForbiddenException("You don't have access to this order");
    if (order.status !== "pending") throw new ConflictException("Order is not awaiting payment");

    // Close earlier attempts first, so one order can never be charged twice.
    // If closing fails the session may have just been paid: re-check it.
    const earlier = await this.prisma.payment.findMany({
      where: { orderId, status: "pending", providerRef: { not: null } },
    });
    for (const attempt of earlier) {
      try {
        await this.provider.expireCheckout(attempt.providerRef!);
        await this.prisma.payment.updateMany({
          where: { id: attempt.id, status: "pending" },
          data: { status: "cancelled" },
        });
      } catch {
        await this.reconcile(attempt);
      }
    }
    const current = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (current?.status !== "pending") throw new ConflictException("Order is already paid");

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: this.provider.name,
        amountCents: order.totalPriceCents,
        currency: "eur",
      },
    });

    const appUrl = this.config.get<string>("APP_URL");
    try {
      const { providerRef, redirectUrl } = await this.provider.createCheckout({
        orderId,
        paymentId: payment.id,
        customerEmail: order.user.email,
        currency: "eur",
        // Prices come from the stored order (priced server-side), never the client.
        lines: order.items.map((line) => ({
          name: line.menuItem.name,
          unitAmountCents: line.unitPriceCents,
          quantity: line.quantity,
        })),
        successUrl: `${appUrl}/?checkout=success&order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/?checkout=cancelled&order=${orderId}`,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
      });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerRef } });
      return { checkoutUrl: redirectUrl };
    } catch (error) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      this.logger.error(`Checkout creation failed for order ${orderId}: ${String(error)}`);
      throw new ServiceUnavailableException("Payment provider unavailable, try again");
    }
  }

  /** Called when the customer is redirected back from the hosted checkout. */
  async confirmReturn(userId: string, sessionId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: sessionId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.order.userId !== userId) {
      throw new ForbiddenException("You don't have access to this payment");
    }

    await this.reconcile(payment);

    return this.prisma.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { menuItem: true } } },
    });
  }

  /**
   * Safety net for customers who paid but never came back to the app (closed
   * the tab): re-checks their recent pending attempts with the provider.
   * Webhooks make this redundant once configured, but it costs little.
   */
  async reconcilePendingForUser(userId: string): Promise<void> {
    if (this.provider.mode === "disabled") return;

    const pending = await this.prisma.payment.findMany({
      where: {
        status: "pending",
        providerRef: { not: null },
        order: { userId },
        createdAt: { gte: new Date(Date.now() - RECONCILE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const payment of pending) {
      try {
        await this.reconcile(payment);
      } catch (error) {
        this.logger.warn(`Could not reconcile payment ${payment.id}: ${String(error)}`);
      }
    }
  }

  /**
   * Before an order is cancelled: close every checkout still open for it, so
   * it can't be paid afterwards, and report whether it is (by now) paid.
   * If a session can't be closed it may have just been paid; re-check it.
   */
  async settleBeforeCancel(orderId: string): Promise<{ paid: boolean }> {
    const open = await this.prisma.payment.findMany({
      where: { orderId, status: "pending", providerRef: { not: null } },
    });
    for (const attempt of open) {
      try {
        await this.provider.expireCheckout(attempt.providerRef!);
        await this.prisma.payment.updateMany({
          where: { id: attempt.id, status: "pending" },
          data: { status: "cancelled" },
        });
      } catch {
        await this.reconcile(attempt);
      }
    }
    const paid = await this.prisma.payment.count({ where: { orderId, status: "succeeded" } });
    return { paid: paid > 0 };
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!rawBody || !signature) throw new BadRequestException("Missing payload or signature");

    let info: CheckoutSessionInfo | null;
    try {
      info = this.provider.parseWebhook(rawBody, signature);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadRequestException("Invalid webhook signature");
    }
    if (!info) return;

    const payment = await this.prisma.payment.findUnique({ where: { providerRef: info.providerRef } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown checkout session ${info.providerRef}`);
      return;
    }
    await this.applyCheckoutInfo(payment, info);
  }

  private async reconcile(payment: Payment): Promise<void> {
    if (payment.status !== "pending" || !payment.providerRef) return;
    await this.applyCheckoutInfo(payment, await this.provider.getCheckout(payment.providerRef));
  }

  /** Idempotent: every write is conditional on the row still being pending. */
  private async applyCheckoutInfo(payment: Payment, info: CheckoutSessionInfo): Promise<void> {
    switch (info.status) {
      case "paid": {
        const matchesOrder =
          info.amountTotalCents === payment.amountCents &&
          info.currency === payment.currency &&
          info.orderId === payment.orderId;
        if (!matchesOrder) {
          this.logger.error(
            `Payment ${payment.id}: paid session ${info.providerRef} does not match the order ` +
              `(amount ${info.amountTotalCents} vs ${payment.amountCents}, order ${info.orderId}); not confirming`,
          );
          await this.setPaymentStatus(payment.id, "failed");
          return;
        }
        await this.prisma.$transaction([
          this.prisma.payment.updateMany({
            where: { id: payment.id, status: "pending" },
            data: { status: "succeeded" },
          }),
          this.prisma.order.updateMany({
            where: { id: payment.orderId, status: "pending" },
            data: { status: "confirmed" },
          }),
        ]);
        return;
      }
      case "expired":
        await this.setPaymentStatus(payment.id, "cancelled");
        return;
      case "failed":
        await this.setPaymentStatus(payment.id, "failed");
        return;
      default:
        return; // open / processing: nothing to record yet
    }
  }

  private async setPaymentStatus(id: string, status: "failed" | "cancelled") {
    await this.prisma.payment.updateMany({ where: { id, status: "pending" }, data: { status } });
  }
}
