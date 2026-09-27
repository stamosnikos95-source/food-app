import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GymsService, netSalesCents, newGymCode } from "./gyms.service";

const config = { get: jest.fn(() => "https://app.example/") };
const gym = (o: Record<string, unknown> = {}) => ({ id: "g1", name: "Pulse Gym", isActive: true, discountPercent: 10, commissionPercent: 5, deliveryEnabled: false, deliveryNote: null, ...o });

describe("gym QR codes", () => {
  it("are random, 10 characters, with no look-alike characters", () => {
    const codes = new Set(Array.from({ length: 500 }, () => newGymCode()));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[2-9a-hjkmnp-z]{10}$/);
  });
});

describe("GymsService", () => {
  it("looks up a live code, counts the scan and builds the order link", async () => {
    const prisma = { gymQrCode: { findUnique: jest.fn().mockResolvedValue({ id: "q1", isActive: true, gym: gym() }), update: jest.fn() } };
    const service = new GymsService(prisma as never, config as never);
    expect(await service.lookup("abc234defg")).toEqual({
      code: "abc234defg", gym: { name: "Pulse Gym", discountPercent: 10, deliveryEnabled: false, deliveryNote: null },
    });
    expect(prisma.gymQrCode.update).toHaveBeenCalledWith({ where: { id: "q1" }, data: { scans: { increment: 1 } } });
    expect(service.orderUrl("abc234defg")).toBe("https://app.example/?gym=abc234defg");
  });

  it("treats revoked codes and inactive gyms as unknown", async () => {
    const svc = (found: unknown) => new GymsService({ gymQrCode: { findUnique: jest.fn().mockResolvedValue(found), update: jest.fn() } } as never, config as never);
    await expect(svc({ id: "q1", isActive: false, gym: gym() }).lookup("x")).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc({ id: "q1", isActive: true, gym: gym({ isActive: false }) }).lookup("x")).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc(null).lookup("x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("re-checks the code when the order is placed, and only delivers where the gym allows it", async () => {
    const tx = (found: unknown) => ({ gymQrCode: { findUnique: jest.fn().mockResolvedValue(found) } });
    const service = new GymsService({} as never, config as never);
    await expect(service.resolveForOrder(tx({ id: "q1", isActive: false, gym: gym() }) as never, "x", "store")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolveForOrder(tx({ id: "q1", isActive: true, gymId: "g1", gym: gym() }) as never, "x", "gym")).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.resolveForOrder(tx({ id: "q1", isActive: true, gymId: "g1", gym: gym({ deliveryEnabled: true }) }) as never, "x", "gym"))
      .toEqual({ gymId: "g1", qrCodeId: "q1", discountPercent: 10 });
  });

  it("reports commission on net sales, with orders per code", async () => {
    const prisma = {
      gym: { findUnique: jest.fn().mockResolvedValue(gym()) },
      order: { findMany: jest.fn().mockResolvedValue([
        { totalPriceCents: 1000, gymDiscountCents: 100, loyaltyDiscountCents: 0, fulfillment: "gym", gymQrCodeId: "q1" },
        { totalPriceCents: 2000, gymDiscountCents: 200, loyaltyDiscountCents: 500, fulfillment: "store", gymQrCodeId: "q1" },
      ]) },
      gymQrCode: { findMany: jest.fn().mockResolvedValue([{ id: "q1", label: "Υποδοχή", isActive: true, scans: 40 }, { id: "q2", label: "Αποδυτήρια", isActive: true, scans: 7 }]) },
    };
    const r = await new GymsService(prisma as never, config as never).report("g1", "2026-10");
    // net = (10.00 - 1.00) + (20.00 - 2.00 - 5.00) = 22.00; 5% = 1.10
    expect(r).toMatchObject({ orders: 2, deliveredToGym: 1, netSalesCents: 2200, memberDiscountCents: 300, commissionCents: 110 });
    expect(r.codes).toEqual([
      { id: "q1", label: "Υποδοχή", isActive: true, scans: 40, orders: 2 },
      { id: "q2", label: "Αποδυτήρια", isActive: true, scans: 7, orders: 0 },
    ]);
    expect(netSalesCents({ totalPriceCents: 850, gymDiscountCents: 85, loyaltyDiscountCents: 0 })).toBe(765);
  });
});
