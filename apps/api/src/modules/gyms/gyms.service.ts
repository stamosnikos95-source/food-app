import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { businessMonth } from "../companies/business-time";

type Db = Prisma.TransactionClient;

// No look-alike characters (0/o, 1/l/i) so a code can be typed from a poster.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 10; // 31^10 ≈ 8·10^14: not guessable

export function newGymCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Net sale value of an order to the business: discounts it gave, not who paid. */
export const netSalesCents = (o: { totalPriceCents: number; gymDiscountCents: number; loyaltyDiscountCents: number }) =>
  o.totalPriceCents - o.gymDiscountCents - o.loyaltyDiscountCents;

@Injectable()
export class GymsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Link printed as the QR code: opens the customer app with the gym attached. */
  orderUrl(code: string) {
    const base = (this.config.get<string>("APP_URL") ?? "").replace(/\/$/, "");
    return `${base}/?gym=${code}`;
  }

  /** Public: what the app shows after a scan. Counts the scan. */
  async lookup(code: string) {
    const found = await this.prisma.gymQrCode.findUnique({ where: { code }, include: { gym: true } });
    if (!found || !found.isActive || !found.gym.isActive) throw new NotFoundException("Unknown or inactive gym code");
    await this.prisma.gymQrCode.update({ where: { id: found.id }, data: { scans: { increment: 1 } } });
    const g = found.gym;
    return {
      code,
      gym: { name: g.name, discountPercent: g.discountPercent, deliveryEnabled: g.deliveryEnabled, deliveryNote: g.deliveryNote },
    };
  }

  /** Inside the order transaction: a code must still be live when the order is placed. */
  async resolveForOrder(tx: Db, code: string, fulfillment: "store" | "gym") {
    const found = await tx.gymQrCode.findUnique({ where: { code }, include: { gym: true } });
    if (!found || !found.isActive || !found.gym.isActive) throw new BadRequestException("This gym code is no longer valid");
    if (fulfillment === "gym" && !found.gym.deliveryEnabled) throw new BadRequestException("This gym doesn't take deliveries");
    return { gymId: found.gymId, qrCodeId: found.id, discountPercent: found.gym.discountPercent };
  }

  // ---- admin -------------------------------------------------------------

  async list() {
    const gyms = await this.prisma.gym.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { qrCodes: { orderBy: { createdAt: "asc" } }, _count: { select: { orders: true } } },
    });
    return gyms.map(({ _count, qrCodes, ...g }) => ({
      ...g,
      orders: _count.orders,
      codes: qrCodes.map((c) => ({ ...c, url: this.orderUrl(c.code) })),
    }));
  }

  create(data: Prisma.GymCreateInput) {
    return this.prisma.gym.create({ data });
  }

  async update(id: string, data: Prisma.GymUpdateInput) {
    await this.ensureGym(id);
    return this.prisma.gym.update({ where: { id }, data });
  }

  async createCode(gymId: string, label: string) {
    await this.ensureGym(gymId);
    // Collisions are astronomically unlikely; retry anyway rather than fail.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const created = await this.prisma.gymQrCode.create({ data: { gymId, label, code: newGymCode() } });
        return { ...created, url: this.orderUrl(created.code) };
      } catch (error) {
        const dup = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!dup || attempt === 2) throw error;
      }
    }
    throw new Error("unreachable");
  }

  async setCodeActive(codeId: string, isActive: boolean) {
    const found = await this.prisma.gymQrCode.findUnique({ where: { id: codeId } });
    if (!found) throw new NotFoundException("QR code not found");
    const updated = await this.prisma.gymQrCode.update({ where: { id: codeId }, data: { isActive } });
    return { ...updated, url: this.orderUrl(updated.code) };
  }

  /** Month report: what the gym brought in and the commission owed to it. */
  async report(gymId: string, month: string) {
    const gym = await this.ensureGym(gymId);
    const { start, end } = businessMonth(month);
    const orders = await this.prisma.order.findMany({
      where: { gymId, status: { not: "cancelled" }, createdAt: { gte: start, lt: end } },
      select: { totalPriceCents: true, gymDiscountCents: true, loyaltyDiscountCents: true, fulfillment: true, gymQrCodeId: true },
    });
    const net = orders.reduce((s, o) => s + netSalesCents(o), 0);
    const byCode = new Map<string, number>();
    for (const o of orders) if (o.gymQrCodeId) byCode.set(o.gymQrCodeId, (byCode.get(o.gymQrCodeId) ?? 0) + 1);
    const codes = await this.prisma.gymQrCode.findMany({ where: { gymId }, orderBy: { createdAt: "asc" } });
    return {
      gym: { id: gym.id, name: gym.name, commissionPercent: gym.commissionPercent, discountPercent: gym.discountPercent },
      month,
      orders: orders.length,
      deliveredToGym: orders.filter((o) => o.fulfillment === "gym").length,
      netSalesCents: net,
      memberDiscountCents: orders.reduce((s, o) => s + o.gymDiscountCents, 0),
      commissionCents: Math.round((net * gym.commissionPercent) / 100),
      codes: codes.map((c) => ({ id: c.id, label: c.label, isActive: c.isActive, scans: c.scans, orders: byCode.get(c.id) ?? 0 })),
    };
  }

  private async ensureGym(id: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException("Gym not found");
    return gym;
  }
}
